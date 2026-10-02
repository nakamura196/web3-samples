/**
 * 自前で書いた 3 つを、外にある答えと突き合わせる。
 *
 *   1. Merkle ツリー   → RFC 6962 の公表されている検証値
 *   2. IPFS の CID     → 公開されている「空のディレクトリ / 空のファイル」の CID
 *   3. seg の抽出      → lxml (リポジトリの build_api.py と同じもの) の結果
 *   4. 署名まわり      → RLP の仕様値・RFC 6979 の公開ベクトル・cast の出力
 *
 * 4 は公開チェーンに出すために足した。ここまで鍵は anvil に預けていたが、
 * 公開チェーンには `eth_sendTransaction` が無いので、署名済みのバイト列を
 * 自分で組む必要がある。**間違えると資金を失うか、他人のアドレスとして
 * 送信される**ので、cast とバイト単位で突き合わせる。
 *
 * 自前実装を信じないための工程なので、**ここが赤いまま先に進んではいけない。**
 *
 *   node scripts/00-selftest.mjs
 */
import {execFileSync} from 'node:child_process';
import {sha256, hex} from '../lib/sha.mjs';
import * as merkle from '../lib/merkle.mjs';
import {cidV0, cidV1, fileCid, emptyDirNode, emptyFileNode, digestFromCid, RAW} from '../lib/cid.mjs';
import {readCorpus, flattenItems} from '../lib/tei.mjs';
import {requireRepo, MASTER_DIR} from '../lib/source.mjs';
import {c, rule, head} from '../lib/ui.mjs';
import {encodeHex} from '../lib/rlp.mjs';
import {sign, verify, publicKey, N as SECP_N} from '../lib/secp256k1.mjs';
import {signTransaction, addressOf} from '../lib/tx.mjs';
import {createHash} from 'node:crypto';

/**
 * lxml による参照実装。リポジトリの scripts/build_api.py が使っているのと同じもので、
 * item API の生成元と同じ経路で seg を数えていることになる。
 */
const PY = `
import json, os, re, sys
from lxml import etree
d = sys.argv[1]
files = sorted([f for f in os.listdir(d) if re.fullmatch(r'\\d+\\.xml', f)], key=lambda f: int(f[:-4]))
out = []
for f in files:
    tree = etree.parse(os.path.join(d, f))
    for seg in tree.iter('{http://www.tei-c.org/ns/1.0}seg'):
        out.append([seg.get('corresp'), ''.join(seg.itertext())])
json.dump(out, sys.stdout, ensure_ascii=False)
`;

let failures = 0;
function check(label, got, want) {
  const ok = String(got) === String(want);
  if (!ok) failures++;
  console.log(`  ${ok ? c.ok('OK  ') : c.ng('NG  ')} ${label}`);
  if (!ok) {
    console.log(`        期待 ${want}`);
    console.log(`        実際 ${got}`);
  }
}

rule('自前実装を、外にある答えと突き合わせる');

// ── 1. Merkle ツリー ────────────────────────────────────────────
head('1. Merkle ツリー — RFC 6962 の定義に合っているか');

// RFC 6962 が明示している 2 つ
check('空のツリー = SHA-256("")',
  hex(merkle.root([])),
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

// 葉が 1 つ: MTH({d0}) = SHA-256(0x00 || d0)
const d0 = Buffer.from('L123456', 'utf8');
check('葉 1 つ = SHA-256(0x00 || d0)',
  hex(merkle.root([merkle.leafHash(d0)])),
  hex(sha256(Buffer.from([0x00]), d0)));

// 分割位置。RFC 6962 は「n より小さい最大の 2 の冪」
check('splitPoint(2) = 1', merkle.splitPoint(2), 1);
check('splitPoint(3) = 2', merkle.splitPoint(3), 2);
check('splitPoint(4) = 2', merkle.splitPoint(4), 2);
check('splitPoint(5) = 4', merkle.splitPoint(5), 4);
check('splitPoint(25065) = 16384', merkle.splitPoint(25065), 16384);

// 葉が 3 つ (2 の冪でない場合の一意性)。手で組んだ式と一致するか
const e = [0, 1, 2].map((i) => Buffer.from(`e${i}`, 'utf8'));
const L = e.map(merkle.leafHash);
check('葉 3 つ = H(0x01 || H(0x01||L0||L1) || L2)',
  hex(merkle.root(L)),
  hex(merkle.nodeHash(merkle.nodeHash(L[0], L[1]), L[2])));

// 包含証明。葉の数を 1..40 まで変え、全ての葉について通ることを確かめる
let proofsChecked = 0;
let proofBroken = 0;
for (let n = 1; n <= 40; n++) {
  const entries = Array.from({length: n}, (_, i) => Buffer.from(`entry-${n}-${i}`, 'utf8'));
  const leaves = entries.map(merkle.leafHash);
  const r = merkle.root(leaves);
  for (let m = 0; m < n; m++) {
    const p = merkle.proof(m, leaves);
    if (!merkle.verify(entries[m], m, n, p, r)) proofBroken++;
    // 位置をずらしたら通ってはいけない
    if (n > 1) {
      const wrong = (m + 1) % n;
      if (merkle.verify(entries[m], wrong, n, p, r)) proofBroken++;
    }
    // 中身を 1 バイト変えたら通ってはいけない
    const tampered = Buffer.concat([entries[m], Buffer.from('!')]);
    if (merkle.verify(tampered, m, n, p, r)) proofBroken++;
    proofsChecked++;
  }
}
check(`包含証明 ${proofsChecked} 通り (葉 1〜40) が通り、偽の証明は落ちる`, proofBroken, 0);

// 証明の長さ
const big = Array.from({length: 25065}, (_, i) => merkle.leafHash(Buffer.from(`x${i}`)));
check('葉 25,065 個のときの証明の長さ <= 15', merkle.proof(0, big).length <= 15, true);

// ── 2. IPFS の CID ─────────────────────────────────────────────
head('2. IPFS の CID — 公開されている検証値と合うか');

// 空の UnixFS ディレクトリ。dag-pb の Data = UnixFS{Type: Directory} = 08 01
check('空ディレクトリの PBNode バイト列 = 0a020801', hex(emptyDirNode()), '0a020801');
check('空ディレクトリ CIDv0 = QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn',
  cidV0(sha256(emptyDirNode())),
  'QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn');
check('空ディレクトリ CIDv1 = bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354',
  cidV1(0x70, sha256(emptyDirNode())),
  'bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354');

// 空の UnixFS ファイル。Data = UnixFS{Type: File, filesize: 0} = 08 02 18 00
check('空ファイルの PBNode バイト列 = 0a0408021800', hex(emptyFileNode()), '0a0408021800');
check('空ファイル CIDv0 = QmbFMke1KXqnYyBBWxB74N4c5SBnJMVAiMNRcGu6x1AwQH',
  cidV0(sha256(emptyFileNode())),
  'QmbFMke1KXqnYyBBWxB74N4c5SBnJMVAiMNRcGu6x1AwQH');

// raw の単一ブロック。ndl-witness で cast と突き合わせ済みの経路
const hello = Buffer.from('hello world\n', 'utf8');
const rawCid = fileCid(hello);
check('"hello world\\n" は raw 1 ブロックになる', rawCid.codec, 'raw');
check('raw の CID から SHA-256 に戻せる',
  hex(digestFromCid(rawCid.cid).digest), hex(sha256(hello)));
check('戻した codec が raw', digestFromCid(rawCid.cid).codec, RAW);

// 256 KiB を超えると dag-pb に切り替わる
const overSized = Buffer.alloc(300 * 1024, 0x41);
const dagCid = fileCid(overSized);
check('300 KiB は dag-pb になる', dagCid.codec, 'dag-pb');
check('300 KiB は 2 チャンクに割れる', dagCid.chunks, 2);
check('境界 (262,144 バイト) はまだ raw', fileCid(Buffer.alloc(262144)).codec, 'raw');
check('境界 +1 で dag-pb', fileCid(Buffer.alloc(262145)).codec, 'dag-pb');

// ── 3. seg の抽出 ──────────────────────────────────────────────
head('3. seg の抽出 — lxml の結果と 1 件ずつ合うか');

requireRepo();
const corpus = readCorpus(MASTER_DIR);
const items = flattenItems(corpus);
check('帖の数 = 54', corpus.length, 54);
check('seg の数 = 25,065 (README の記載と一致)', items.length, 25065);

let lxml;
try {
  lxml = execFileSync('python3', ['-c', PY, MASTER_DIR], {encoding: 'utf8', maxBuffer: 256 * 1024 * 1024});
} catch (err) {
  console.log(`  ${c.warn('SKIP')} lxml が使えないため突き合わせを飛ばしました (${err.message.split('\n')[0]})`);
  lxml = null;
}

if (lxml) {
  const ref = JSON.parse(lxml);
  check('lxml が数えた seg の数と一致', ref.length, items.length);

  // 走査器が拾ったのはソースのバイト列そのものなので、lxml の再直列化とは
  // 引用符やエンティティの扱いで一致しない可能性がある。**境界が正しいか**を
  // 見たいので、タグを落としたテキストで突き合わせる。
  const stripTags = (s) => s.replace(/<[^>]*>/g, '');
  const unescape = (s) => s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&'); // &amp; は最後
  let uriDiff = 0, textDiff = 0, firstDiff = null;
  for (let i = 0; i < Math.min(ref.length, items.length); i++) {
    if (ref[i][0] !== items[i].corresp) { uriDiff++; firstDiff ??= i; }
    if (ref[i][1] !== unescape(stripTags(items[i].inner))) { textDiff++; firstDiff ??= i; }
  }
  check('corresp が 25,065 件すべて一致', uriDiff, 0);
  check('本文 (タグを落としたもの) が 25,065 件すべて一致', textDiff, 0);
  if (firstDiff !== null) {
    console.log(`        最初に食い違った位置 ${firstDiff}`);
    console.log(`        lxml  : ${JSON.stringify(ref[firstDiff])}`);
    console.log(`        走査器: ${JSON.stringify([items[firstDiff].corresp, unescape(stripTags(items[firstDiff].inner))])}`);
  }
}

// ── 4. 署名まわり ────────────────────────────────────────────────
head('4. RLP — 仕様に載っている値と合うか');

check('"dog" = 0x83646f67', encodeHex(Buffer.from('dog')), '0x83646f67');
check('["cat","dog"] = 0xc88363617483646f67',
  encodeHex([Buffer.from('cat'), Buffer.from('dog')]), '0xc88363617483646f67');
check('空のバイト列 = 0x80', encodeHex(Buffer.alloc(0)), '0x80');
check('空のリスト = 0xc0', encodeHex([]), '0xc0');
check('入れ子 [[],[[]],[[],[[]]]] = 0xc7c0c1c0c3c0c1c0',
  encodeHex([[], [[]], [[], [[]]]]), '0xc7c0c1c0c3c0c1c0');
check('1024 = 0x820400 (前ゼロを付けない)', encodeHex(1024n), '0x820400');
// ここが nonce 0 の落とし穴。数の 0 は空で、1 バイトの 0x00 とは別物
check('数の 0 は空になる (0x80)', encodeHex(0n), '0x80');
check('1 バイトの 0x00 はそのまま (0x00)', encodeHex('0x00'), '0x00');

head('5. ECDSA — RFC 6979 の公開ベクトルと合うか');

// 広く引かれている secp256k1 の検証値 (秘密鍵 1 / "Satoshi Nakamoto" の SHA-256)
const satoshi = sign(createHash('sha256').update('Satoshi Nakamoto').digest(),
  '0x' + '0'.repeat(63) + '1');
check('RFC6979 の r', satoshi.hex.r,
  '0x934b1ea10a4b3c1757e2b0c017d0b6143ce3c9a7e6a4a49860d7a6ab210ee3d8');
check('RFC6979 の s', satoshi.hex.s,
  '0x2442ce9d2b916064108014783e923ec36b49743e2ffa1c4496f01a512aafd9e5');

// anvil の既定アカウント #0。**公開されている鍵**なので秘密ではない
const ANVIL0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
check('鍵 → アドレスが anvil #0 と一致',
  addressOf(ANVIL0), '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');

const selfHash = createHash('sha256').update('genji-witness').digest();
const selfSig = sign(selfHash, ANVIL0);
check('自分の署名を自分で検証できる', verify(selfHash, selfSig, publicKey(ANVIL0)), true);
check('low-s に正規化されている (EIP-2)', selfSig.s <= SECP_N / 2n, true);
check('決定的 — 2 回署名しても同じ', sign(selfHash, ANVIL0).hex.s, selfSig.hex.s);

head('6. EIP-1559 の組み立て — cast とバイト単位で合うか');

const TO = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const base = {chainId: 11155111n, maxPriorityFeePerGas: 2000000000n,
  maxFeePerGas: 30000000000n, gas: 200000n};
/**
 * 空欄になる欄 (nonce 0 / value 0) と、to の無いコントラクト作成を必ず入れる。
 * ここが RLP の最小表現でずれると、署名は有効なまま **別のアドレスから来た**
 * ことになって落ちる。落ち方が分かりにくいので固定しておく。
 */
const txCases = [
  ['ふつうの送金', {...base, nonce: 7n, to: TO, value: 1000000000000000n, data: '0x'}],
  ['nonce 0', {...base, nonce: 0n, to: TO, value: 1000000000000000n, data: '0x'}],
  ['value 0', {...base, nonce: 3n, to: TO, value: 0n, data: '0x'}],
  ['nonce 0 かつ value 0', {...base, nonce: 0n, to: TO, value: 0n, data: '0x'}],
  ['data あり', {...base, nonce: 1n, to: TO, value: 0n,
    data: '0xa9059cbb'
      + '70997970c51812dc3a010c7d01b50e0d17dc79c8'.padStart(64, '0')
      + (10n ** 18n).toString(16).padStart(64, '0')}],
  ['長い data (DDO と同じ 1,561 バイト)', {...base, nonce: 2n, to: TO, value: 0n,
    data: '0x' + 'ab'.repeat(1561)}],
  ['to なし (コントラクト作成)', {...base, nonce: 9n, to: '', value: 0n,
    data: '0x6080604052348015600e575f80fd5b50'}],
];

let castMissing = false;
for (const [label, tx] of txCases) {
  const mine = signTransaction(tx, ANVIL0);
  const args = ['mktx', '--private-key', ANVIL0, '--nonce', String(tx.nonce),
    '--gas-limit', String(tx.gas), '--gas-price', String(tx.maxFeePerGas),
    '--priority-gas-price', String(tx.maxPriorityFeePerGas),
    '--chain', String(tx.chainId), '--value', String(tx.value)];
  if (tx.to) args.push(tx.to, tx.data); else args.push('--create', tx.data);
  let theirs;
  try {
    theirs = execFileSync('cast', args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  } catch {
    castMissing = true;
    break;
  }
  check(`${label} — cast と一致`, mine.raw, theirs);
}
if (castMissing) {
  console.log(`  ${c.warn('SKIP')} cast が無いので突き合わせを飛ばした (foundry を入れると走る)`);
}


console.log('');
if (failures > 0) {
  console.log(c.ng(`${failures} 件が合っていません。ここが赤いまま先に進まないこと。`));
  process.exit(1);
}
console.log(c.ok('すべて一致しました。'));
