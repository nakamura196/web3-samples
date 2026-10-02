/**
 * **帰属を書き直す。** 既定では送りません。
 *
 *   op run --env-file=.env.local -- node scripts/19-reattribute.mjs           下見
 *   op run --env-file=.env.local -- node scripts/19-reattribute.mjs --send    実行
 *   … --only=1           1 帖だけ
 *   … --with-name        公開者の氏名を載せる (既定は載せない)
 *   … --with-contributors 担当者 5 名の氏名を載せる (既定は載せない)
 *
 * ── なぜ書き直すのか ────────────────────────────────────────────
 * 最初の DDO は author に 'Satoru Nakamura / 中村 覚' と**手で書いていた**。
 * TEI ヘッダを 54 帖すべて集計したところ、実際は 5 名の分担だった
 * (翻刻 3 名 / TEI 化 1 名 / 助言 1 名)。1 人だけを author にしていたのは
 * 学術資料として不正確である。CC0 でも帰属表示は意味を持つ。
 *
 * 底本の「1942」も手で書いていたが、**TEI に年の記載は無い**。無い情報を足していた。
 *
 * ── 氏名は誰のものであれ載せない ────────────────────────────────
 * **チェーンへの記録は取り消せない。** EDPB のブロックチェーン指針 (02/2025) は
 * 個人情報をチェーンに置くことを平文・暗号化・ハッシュのいずれでも認めていない。
 * 他人の氏名だけでなく、**公開者自身の氏名も既定では載せない**。
 *
 *   author に入るのは  0xA787b1285d7D0Cf5284167Ce278774371946A3aA (アドレスのみ)
 *   身元を名乗るのは   自分のサイトに置いた署名つきの宣言 (消せる)
 *
 * 宣言を消せば、アドレスは再びただのアドレスに戻る。これが指針の言う
 * 「チェーンは指すだけ、身元は消せる側に置く」形である。
 * --with-name / --with-contributors で入るが、**入れたら取り消せない**。
 *
 * ── root から導けるものは載せない ────────────────────────────────
 * 前の版の DDO は 2,725 バイトあり、その 43% は他から導ける値だった。
 * 手元で実際に再計算して一致を確認したもの:
 *
 *   leafHash  sha256(0x00 ‖ ファイルの中身)         RFC 6962 の葉の定義
 *   bytes     ファイルのバイト数
 *   lines     <seg> の出現回数
 *   ipfsCid   UnixFS raw CIDv1 (256 KiB 未満は 1 塊)
 *   did       'did:op:' + sha256(EIP-55 addr ‖ chainId)
 *
 * さらに chapterRoot / corpusId は **CorpusAnchor に既に刻んである値の写し**、
 * ipfsUri は ipfsCid に接頭辞を足しただけ、volumeTitle と file は name と
 * volumeNumber から作れる。description は 731 バイトのうち大半が他の欄の再掲だった。
 *
 * **残すのは、他の 53 帖を持っていないと作れないもの (inclusionProof) と、
 * 本文への入口 (ipfsCid)、証明の検算に要るもの、どこからも導けない宣言だけ。**
 *
 * 落とすと一覧に「328 行」を出すのに本文 77 KB が要る。それは
 * オフチェーンの索引 (genji-x の src/data/tei-facets.json) が持つ。
 * **「証明が要る値」と「速く出したい値」は別物で、置き場所も別でよい。**
 *
 * ── 役割を分ける ────────────────────────────────────────────────
 *   author (Ocean の欄)  この記録をチェーンに載せた人
 *   creator              資料そのものの作成主体
 *   isBasedOn            元になった資料
 * schema.org の sdPublisher / creator / isBasedOn にあたる。
 * 曖昧なまま 1 人の名前を置くと「1 人で作った」と読まれる。
 *
 * ── 上書きではなく追記 ──────────────────────────────────────────
 * setMetaData をもう一度呼ぶと、新しい版が記録される。前の記録も残る。
 * 「最初は 1 人だけを author にしていた」という経緯もチェーン上に残る。
 * それは隠すことではなく、記事にすべき経緯である。
 */
import {SIG, TYPES, TOPIC, SEPOLIA, buildDdo, ddoHash, attributionFrom, sourceLine}
  from '../lib/ocean.mjs';
import {encodeCall, bytesAt} from '../lib/abi.mjs';
import * as merkle from '../lib/merkle.mjs';
import {readHeader, readCorpus} from '../lib/tei.mjs';
import {requireRepo} from '../lib/source.mjs';
import {selectChain} from '../lib/chains.mjs';
import {connect, waitReceipt, gasUsed, sendSigned, balanceOf, baseFee,
  feePaid, formatEth} from '../lib/rpc.mjs';
import {addressOf, feesFrom} from '../lib/tx.mjs';
import {readCorpusOut, readJson, writeJson, OUT, rel} from '../lib/store.mjs';
import {c, rule, head, padTo, argOf} from '../lib/ui.mjs';
import fs from 'node:fs';
import path from 'node:path';

const send = process.argv.includes('--send');
const withContributors = process.argv.includes('--with-contributors');
/** 公開者自身の氏名を載せるか。**既定は載せない (取り消せないため)** */
const withName = process.argv.includes('--with-name');
const only = argOf('only') ? Number(argOf('only')) : null;
const n = (x) => Number(x).toLocaleString('en-US');

const priv = process.env.SEPOLIA_PRIVATE_KEY;
if (!priv || priv.startsWith('op://')) {
  console.error(c.ng('SEPOLIA_PRIVATE_KEY がありません (op run を通していますか)'));
  process.exit(1);
}
const ME = addressOf(priv);

const chain = selectChain('sepolia');
const conn = await connect(chain);
const corpusOut = readCorpusOut();
const sepolia = readJson(path.join(OUT, 'sepolia.json'), 'node scripts/07-sepolia.mjs --send');
const whole = readJson(path.join(OUT, 'publish.json'), 'node scripts/11-publish.mjs --send');
const vols = readJson(path.join(OUT, 'volumes.json'), 'node scripts/16-publish-volumes.mjs --send');
const ipfs = readJson(path.join(OUT, 'ipfs.json'), 'node scripts/08-ipfs.mjs --upload');

const corpus = readCorpus(requireRepo());
const SITE = 'https://kouigenjimonogatari.github.io/';
/**
 * **宣言の URL はチェーンに載せない (2026-08-26 の判断)。**
 *
 * 当初は `.well-known/genji-witness.json` の URL を DDO に書く案だった。
 * やめた理由は 2 つ:
 *
 *   1. 置き場所が決まっていなかった。本家サイトは
 *      `kouigenjimonogatari` **組織**のリポジトリで、中村 1 人のものではない。
 *      個人の身元を名乗るファイルを共同プロジェクトのサイトに置くのは筋が違う
 *   2. **URL も永久に残る。** 55 件に書けば、後で置き場所を変えられない。
 *      リンク切れになっても直せない
 *
 * チェーンに残すのは**アドレスだけ**にする。「その鍵が誰か」は
 * カタログ (genji-x) が画面で示す。置き場所は後から自由に変えられ、
 * 消したければ消せる。これが指針の言う「消せる側に身元を置く」形である。
 *
 * 署名つきの宣言そのものは out/well-known/genji-witness.json にある
 * (scripts/12-declare.mjs が作る)。cast で検証できることは確認済み。
 */
const DECLARATION = null;
/** --with-name のときだけ使う。既定では 1 度も参照されない */
const PUBLISHER_NAME = 'Satoru Nakamura / 中村 覚';

rule(send ? '帰属を書き直す' : '帰属を書き直す — 下見 (送りません)');
console.log(`  ${c.warn('これは上書きではなく追記です。前の記録も残ります。')}`);
console.log(`  ${withName ? c.warn('公開者の氏名を載せます (--with-name)。取り消せません')
  : c.ok('氏名は載せません。author はアドレスのみです')}`);

// ── TEI から帰属を作る ──────────────────────────────────────────
const header = readHeader(corpus[0].bytes.toString('utf8'));
head('TEI ヘッダから読んだもの');
console.log(`  作成主体      ${header.authority ?? header.distributor}`);
console.log(`  担当者        ${header.contributors.length} 名  ` +
  c.dim(header.contributors.map((x) => x.role).filter((v, i, a) => a.indexOf(v) === i).join(' / ')));
console.log(`  底本          ${sourceLine(header)}`);
console.log(`  ライセンス     ${header.license}`);
console.log(`  ${withContributors ? c.warn('氏名を載せます (--with-contributors)') : c.ok('氏名は載せません')}`);

const attribution = attributionFrom(header, {
  publishedBy: ME,                                    // アドレスのみ
  publishedByName: withName ? PUBLISHER_NAME : null,  // 既定では入らない
  declarationUri: DECLARATION,
  includeContributors: withContributors,
  attributionUri: SITE,
});

/**
 * **帖ごとの中身は out/corpus.json から取り直す。**
 *
 * out/volumes.json は「公開したときの値」で、CID も葉ハッシュも包含証明も
 * その時点のものである。素材の版が変われば全部変わるのに、そのまま使うと
 * **古い CID と古い証明を新しい DDO に書いてしまう**（実際、下見で
 * 「ipfsCid 同じ / inclusionProof 同じ」と出て気づいた）。
 *
 * volumes.json から引き継ぐのは **アドレスと DID だけ**。
 * data NFT と datatoken は版が変わっても同じものを使い続ける。
 */
const chapterLeaves = corpusOut.chapters.map((ch) => Buffer.from(ch.leafHash, 'hex'));
const ipfsByName = new Map((ipfs.files ?? []).map((f) => [f.name, f]));
/** 帖 1 件ぶんの、いまの版の値 */
function current(file, index) {
  const ch = corpusOut.chapters[index];
  if (!ch || ch.name !== file) throw new Error(`corpus.json と対応が取れません: ${file}`);
  const f = ipfsByName.get(file);
  if (!f) throw new Error(`ipfs.json に ${file} がありません。08-ipfs.mjs を先に実行してください`);
  return {
    cid: f.cid,
    lines: ch.segs,
    bytes: ch.bytes,
    leafHash: '0x' + ch.leafHash,
    proof: merkle.proof(index, chapterLeaves).map((b) => '0x' + b.toString('hex')),
  };
}

// ── 対象 ────────────────────────────────────────────────────────
const targets = [];
if (!only) {
  // 全体版はディレクトリの CID。これも 08-ipfs.mjs が作り直したものを使う
  targets.push({key: 'all', nft: whole.nft, datatoken: whole.datatoken,
    title: null, number: null, cid: ipfs.directory.cid, index: null});
}
for (const [num, v] of Object.entries(vols.volumes)) {
  if (only && Number(num) !== only) continue;
  // 葉の位置は帖の番号で決まる（0 起算）。版が変わっても並びは変わらない
  const index = v.number - 1;
  const now = current(v.file, index);
  targets.push({key: num, nft: v.nft, datatoken: v.datatoken, title: v.title,
    number: v.number, index, file: v.file, ...now});
}

/** 帖 1 件ぶんの DDO を、TEI 由来の帰属で組み直す */
function ddoFor(t, iso) {
  const isVolume = t.number != null;
  // 原本画像 (IIIF) は TEI の <graphic url> から出るので、ここでは読まない。
  // 索引側 (genji-x の tei-facets.json) が持つ

  return buildDdo({
    nftAddress: t.nft, chainId: chain.chainId, datatokenAddress: t.datatoken, created: iso,
    service: {id: isVolume ? `genji-${String(t.number).padStart(2, '0')}` : 'genji-tei',
      serviceEndpoint: `ipfs://${t.cid}`},
    metadata: {
      name: isVolume ? `校異源氏物語 ${t.title}（第${t.number}帖）` : '校異源氏物語 (TEI/XML)',
      /**
       * **1 文だけにする。** 前の版は 731 バイトあり、全体の 27% を占めていた。
       * 中身は ipfsCid・leafHash・chapterRoot・corpusAnchor・証明の個数の再掲で、
       * どれも隣の additionalInformation に構造化されて入っている。
       *
       * 人が読みやすいようにと重複を作ったが、**取り消せない場所では
       * 重複も永久に残る**。読みやすい説明はカタログ側 (genji-x) が出せばよい。
       */
      description: isVolume
        ? `${sourceLine(header)} を底本とする源氏物語の校異データ。第${t.number}帖「${t.title}」。`
        : `${sourceLine(header)} を底本とする源氏物語の校異データ。全 54 帖。`,
      ...attribution,
      /**
       * **`volume-01` のような札は入れない。** volumeNumber から作れる。
       * 残りの 6 個は 55 件すべてで同じ値だが、この資料が何であるかの宣言なので残す。
       */
      tags: ['tei', 'genji', 'japanese-classics', 'digital-humanities', 'merkle', 'rfc6962'],
      /**
       * **root から導けるものは入れない。** 落としたものと理由:
       *
       *   leafHash     sha256(0x00 ‖ 本文) で出る。本文は ipfsCid から取れる
       *   lines/bytes  本文を数えれば出る。一覧に速く出したいだけなら索引側の仕事
       *   volumeTitle  name に入っている
       *   file         volumeNumber から作れる (`01.xml`)
       *   ipfsUri      ipfsCid に `ipfs://` を足しただけ
       *   chapterRoot  **CorpusAnchor に既に刻んである**。チェーン上の写し
       *   corpusId     同上
       *   iiifManifest TEI の <graphic url> から出る。索引側 (tei-facets) が持つ
       *
       * 入口だけは残す。ipfsCid が無いと本文に辿り着けず、
       * 上の「導ける」が全部できなくなる。**導ける向きは一方通行である。**
       */
      additionalInformation: {
        ...attribution.additionalInformation,
        ...(isVolume ? {
          volumeNumber: t.number,
          // 証明の検算に要る 3 つ。RFC 6962 は位置と木の大きさを使う
          leafIndex: t.index, treeSize: 54, inclusionProof: t.proof,
          merkleSpec: corpusOut.trees.chapter.spec,
          wholeCorpusNft: whole.nft,
        } : {
          // 全体版だけは root を持つ。ここが唯一の出どころなので写しではない
          chapters: 54,
          itemRoot: corpusOut.trees.item.root,
          itemTreeSize: corpusOut.trees.item.treeSize,
          merkleSpec: corpusOut.trees.chapter.spec,
        }),
        // どこを見れば root があるか。無いと第三者が走査範囲を決められない
        corpusAnchor: sepolia.corpusAnchor,
        corpusAnchorFromBlock: sepolia.transactions[0].block,
        // 素材のどの版か。**どこからも導けない宣言**
        sourceCommit: corpusOut.source.commit,
        // 本文への入口
        ipfsCid: t.cid,
      },
    },
  });
}

head('書き直すもの');
console.log(`  対象        ${targets.length} 件`);
const sample = ddoFor(targets[targets.length > 1 ? 1 : 0], new Date().toISOString());
const sampleJson = JSON.stringify(sample);
/**
 * **バイト数は Buffer.byteLength で測る。**
 * `String.length` は UTF-16 の符号単位を数えるので、日本語 1 文字が 1 と出る。
 * 実際にチェーンへ送るのは UTF-8 なので 1 文字 3 バイト。
 * ここを取り違えて「30% 減」と報告したが、正しくは 24% 減だった。
 */
const sampleBytes = Buffer.byteLength(sampleJson, 'utf8');
console.log(`  DDO の大きさ  ${n(sampleBytes)} バイト  ${c.dim('(書き直す前は 2,725 バイト)')}`);

const fees = feesFrom(await baseFee(conn));
const PER = 320000n;
console.log(`  1 件あたり    約 ${n(PER)} ガス = ${formatEth(PER * (fees.maxFeePerGas / 2n))}`);
console.log(`  合計          ${formatEth(PER * BigInt(targets.length) * (fees.maxFeePerGas / 2n))}`);
console.log(`  残高          ${formatEth(await balanceOf(conn, ME))}`);

if (!send) {
  head('見本 (第1帖の DDO 全体)');
  console.log(JSON.stringify(sample, null, 1).split('\n').map((l) => '  ' + l).join('\n'));

  head('項目ごとの大きさ');
  const B = (v) => Buffer.byteLength(JSON.stringify(v), 'utf8');
  const rows = [];
  (function walk(o, pre = '') {
    for (const [k, v] of Object.entries(o)) {
      const q = pre ? `${pre}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v) && q.split('.').length < 3) walk(v, q);
      else rows.push([B(v), q]);
    }
  })(sample);
  rows.sort((x, y) => y[0] - x[0]);
  for (const [b, k] of rows) console.log(`  ${String(b).padStart(5)}  ${k}`);

  head('前の版との差');
  const BEFORE = 2725;   // きりつぼの前の DDO (実測)
  console.log(`  前          ${n(BEFORE)} バイト`);
  console.log(`  今          ${n(sampleBytes)} バイト`);
  console.log(`  減った分     ${n(BEFORE - sampleBytes)} バイト  ` +
    `(${Math.round((1 - sampleBytes / BEFORE) * 100)}% 減)`);
  console.log(`  55 件ぶん    約 ${n((BEFORE - sampleBytes) * 55)} バイト = ` +
    `約 ${n((BEFORE - sampleBytes) * 55 * 16)} ガス ${c.dim('(calldata 非ゼロ 1 バイト 16 ガス)')}`);

  head('氏名が入っていないことの確認');
  const hit = ['中村', 'Satoru', 'Nakamura'].filter((w) => sampleJson.includes(w));
  console.log(hit.length === 0
    ? `  ${c.ok('入っていません')}`
    : `  ${c.ng('入っています: ' + hit.join(', '))} ${withName ? c.dim('(--with-name)') : ''}`);
  // 検算に使えるよう、見本をファイルにも落とす
  const previewFile = path.join(OUT, 'reattribute-preview.json');
  writeJson(previewFile, sample);
  console.log('');
  console.log(`  ${c.dim('見本の書き出し: ' + rel(previewFile))}`);
  console.log(c.warn('  下見なので、ここで終わります。何も送っていません。'));
  process.exit(0);
}

// ── 書き直す ────────────────────────────────────────────────────
head('送ります');
const outFile = path.join(OUT, 'reattributed.json');
const done = fs.existsSync(outFile) ? readJson(outFile) : {updated: {}};
let spent = 0n;

for (const t of targets) {
  if (done.updated[t.key]) continue;
  const label = t.number ? `${String(t.number).padStart(2)} ${padTo(t.title, 12)}` : padTo('全体', 15);
  try {
    const blk = await conn.call('eth_getBlockByNumber', ['latest', false]);
    const iso = new Date(Number(BigInt(blk.timestamp)) * 1000).toISOString();
    const json = JSON.stringify(ddoFor(t, iso));
    const data = encodeCall(SIG.setMetaData, TYPES.setMetaData, [
      0n, `ipfs://${t.cid}`, ME, '0x00',
      '0x' + Buffer.from(json, 'utf8').toString('hex'), ddoHash(json), [],
    ]);
    const sent = await sendSigned(conn, {to: t.nft, data, gas: 600000n, ...fees}, priv);
    const rc = await waitReceipt(conn, sent.hash, {tries: 150, intervalMs: 2000});
    if (rc.status !== '0x1') throw new Error('失敗');
    spent += feePaid(rc);
    done.updated[t.key] = {nft: t.nft, tx: sent.hash, gas: gasUsed(rc), bytes: json.length,
      block: parseInt(rc.blockNumber, 16)};
    done.generatedAt = new Date().toISOString();
    done.note = '上書きではなく追記。前の記録も残っている';
    writeJson(outFile, done);
    console.log(`  ${label} ${c.ok('更新')} ${String(gasUsed(rc)).padStart(7)} ガス  DDO ${n(json.length)}B`);
  } catch (e) {
    console.log(`  ${label} ${c.ng('失敗')} ${String(e.message).slice(0, 60)}`);
    console.log(`  ${c.dim('ここまでは out/reattributed.json に残っています。同じコマンドで続きから。')}`);
    break;
  }
}

head('結果');
console.log(`  更新した      ${Object.keys(done.updated).length} / ${targets.length} 件`);
console.log(`  払った手数料   ${formatEth(spent)}`);
console.log(`  残高          ${formatEth(await balanceOf(conn, ME))}`);
console.log(`  書き出し      ${rel(outFile)}`);
