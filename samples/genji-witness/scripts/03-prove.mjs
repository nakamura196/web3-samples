/**
 * 25,065 行のうち **1 行だけ**を、本文全体を渡さずに証明する。
 *
 *   node scripts/03-prove.mjs 0005-01
 *   node scripts/03-prove.mjs https://w3id.org/kouigenjimonogatari/api/items/1062-01.json
 *
 * ── これが git にできないこと ────────────────────────────────────
 * git は「このファイルはこの内容だった」を証明できる。ただし
 * **相手がリポジトリを持っている**か、少なくとも帖 1 本 (最大 309 KB) を
 * 受け取れる場合の話である。blob の粒度がファイル単位だからで、
 * 「34.xml の 1062-01 行だけが本物」という形の証明は git から取り出せない。
 *
 * Merkle ツリーだと、渡すものは
 *
 *   その行そのもの (数十〜数百バイト) + 経路 15 ハッシュ (480 バイト)
 *
 * だけになる。受け取った側は root と突き合わせるだけで済む。
 * root は 02-anchor でチェーンに載っており、誰も消せない。
 *
 * ── 手元の計算を信じない ────────────────────────────────────────
 * off-chain (lib/merkle.mjs) で作った経路を、**コントラクトに検証させる**。
 * 同じ RFC 6962 を JavaScript と Solidity で 2 回書いているので、
 * 片方の思い違いはここで露出する。テストの合成データではなく
 * 実物の 25,065 行に対して突き合わせるのが、この工程の意味である。
 */
import {hex, b32} from '../lib/sha.mjs';
import * as merkle from '../lib/merkle.mjs';
import {SIG, encodeCall, encodeArgs, asBool} from '../lib/abi.mjs';
import {selectChain} from '../lib/chains.mjs';
import {connect, ethCall} from '../lib/rpc.mjs';
import {readCorpus, flattenItems, itemEntry} from '../lib/tei.mjs';
import {requireRepo} from '../lib/source.mjs';
import {readAnchored, readDeployed} from '../lib/store.mjs';
import {c, rule, head, positional, padTo} from '../lib/ui.mjs';

const ITEM_BASE = 'https://w3id.org/kouigenjimonogatari/api/items/';
const asked = positional(0) ?? '0005-01';
const wanted = asked.startsWith('http') ? asked : `${ITEM_BASE}${asked}.json`;

const anchored = readAnchored();
const deployed = readDeployed();

rule(`1 行を証明する — ${asked}`);

// ── 経路を作る ──────────────────────────────────────────────────
const corpus = readCorpus(requireRepo());
const items = flattenItems(corpus);
const index = items.findIndex((it) => it.corresp === wanted);
if (index < 0) {
  console.error(`その URI は 25,065 行の中にありません: ${wanted}`);
  console.error(`例: node scripts/03-prove.mjs ${items[0].corresp.slice(ITEM_BASE.length, -5)}`);
  process.exit(1);
}

const item = items[index];
const entries = items.map((it) => itemEntry(it.corresp, it.inner));
const leaves = entries.map(merkle.leafHash);
const treeSize = leaves.length;
const root = merkle.root(leaves);
const path = merkle.proof(index, leaves);
const entry = entries[index];

head('証明したい 1 行');
console.log(`  帖         ${item.chapter}`);
console.log(`  URI        ${item.corresp}`);
console.log(`  位置       ${index.toLocaleString('en-US')} / ${treeSize.toLocaleString('en-US')}`);
console.log(`  本文       ${item.inner.length > 60 ? item.inner.slice(0, 60) + '…' : item.inner}`);
console.log(`  葉         ${hex(leaves[index])}`);
console.log(`  ${c.dim('葉のバイト列 = URI + 0x00 + seg の中身。URI を混ぜるのは')}`);
console.log(`  ${c.dim('「この行番号の本文がこれ」を主張したいから (どこかにあった、ではない)')}`);

head('渡すもの');
const pathBytes = path.length * 32;
console.log(`  経路       ${path.length} ハッシュ = ${pathBytes} バイト`);
console.log(`  行そのもの ${entry.length} バイト`);
console.log(`  ${c.b('合計')}       ${(pathBytes + entry.length).toLocaleString('en-US')} バイト`);
console.log(`  ${c.dim(`本文全体だと ${(5871913).toLocaleString('en-US')} バイト → ` +
  `${Math.round(5871913 / (pathBytes + entry.length)).toLocaleString('en-US')} 分の 1`)}`);
console.log('');
for (const [i, h] of path.entries()) {
  console.log(`   ${String(i).padStart(2)}  ${c.dim(hex(h))}`);
}

// ── 手元で検証 ──────────────────────────────────────────────────
head('手元で検証 (lib/merkle.mjs)');
const localOk = merkle.verify(entry, index, treeSize, path, root);
console.log(`  root       ${b32(root)}`);
console.log(`  結果       ${localOk ? c.ok('一致') : c.ng('不一致')}`);

// 刻まれた root と同じか。ここが違うなら素材が変わっている
const anchoredRoot = anchored.trees.item.root;
const sameAsAnchored = anchoredRoot.toLowerCase() === b32(root).toLowerCase();
console.log(`  刻まれた root と ${sameAsAnchored ? c.ok('同じ') : c.ng('違う (素材が変わっている)')}`);
if (!sameAsAnchored) {
  console.log(`  ${c.dim('刻まれた: ' + anchoredRoot)}`);
  console.log(`  ${c.warn('この場合は 01-digest から刻み直すか、どの行が変わったかを out/leaves.json と突き合わせる')}`);
}

// ── チェーン上で検証 ────────────────────────────────────────────
head('チェーン上で検証 (CorpusAnchor.verifyInclusion)');
const chain = selectChain();
const conn = await connect(chain);
const to = deployed.corpusAnchor;

const callVerify = async (r, e, p, i, n) =>
  asBool(await ethCall(conn, to, encodeCall(
    SIG.verifyInclusion, ['bytes32', 'bytes', 'bytes32[]', 'uint64', 'uint64'],
    [r, e, p.map((h) => '0x' + hex(h)), i, n],
  )));

// 葉と節のハッシュが 2 つの言語で一致するか。ここがずれると経路も全部ずれる
const chainLeaf = await ethCall(conn, to, encodeCall(SIG.leafHash, ['bytes'], [entry]));
const chainNode = await ethCall(conn, to, encodeCall(SIG.nodeHash, ['bytes32', 'bytes32'],
  [b32(leaves[0]), b32(leaves[1])]));
console.log(`  leafHash   ${chainLeaf.toLowerCase() === b32(leaves[index]).toLowerCase()
  ? c.ok('JavaScript と Solidity で一致') : c.ng('不一致')}`);
console.log(`  nodeHash   ${chainNode.toLowerCase() === b32(merkle.nodeHash(leaves[0], leaves[1])).toLowerCase()
  ? c.ok('JavaScript と Solidity で一致') : c.ng('不一致')}`);

const chainOk = await callVerify(b32(root), entry, path, index, treeSize);
console.log(`  検証       ${chainOk ? c.ok('true') : c.ng('false')}`);

// ── 偽物を弾くか ────────────────────────────────────────────────
// 「通ること」だけ見ても意味がない。**通ってはいけないもの**が落ちるかを見る
head('偽物を弾くか');

const tampered = Buffer.from(entry);
tampered[tampered.length - 1] ^= 0x01; // 最後の 1 バイトだけ変える
const shifted = index === 0 ? 1 : index - 1;

const cases = [
  ['本文を 1 ビット変える', await callVerify(b32(root), tampered, path, index, treeSize)],
  ['位置を 1 つずらす', await callVerify(b32(root), entry, path, shifted, treeSize)],
  ['経路の 1 本を落とす', await callVerify(b32(root), entry, path.slice(0, -1), index, treeSize)],
  ['別の root と照合する', await callVerify(anchored.trees.chapter.root, entry, path, index, treeSize)],
];
for (const [label, got] of cases) {
  console.log(`  ${padTo(label, 28)} ${got ? c.ng('通ってしまった') : c.ok('落ちた')}`);
}

const allGood = localOk && chainOk && cases.every(([, got]) => !got);

head('まとめ');
console.log(`  ${allGood ? c.ok('本物は通り、偽物は落ちた') : c.ng('検証に失敗した')}`);
console.log('');
console.log(`  ${c.b('チェーンが要るのはここではない。')}`);
console.log(`  ${c.dim('この検証は root さえ手元にあれば紙に書いた root でも成り立つ (純関数)。')}`);
console.log(`  ${c.dim('チェーンが要るのは、その root が「消されない」「第三者が足せる」ため。')}`);
console.log(`  ${c.dim('検証そのものは誰のサーバも要らない — それが要点。')}`);

process.exit(allGood ? 0 : 1);
