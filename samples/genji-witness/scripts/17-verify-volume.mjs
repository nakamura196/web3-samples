/**
 * **第三者の立場で 1 帖を検証する。** 手元の out/ を一切見ない。
 *
 *   node scripts/17-verify-volume.mjs --nft=0x…
 *   node scripts/17-verify-volume.mjs --volume=1
 *
 * ── 何を証明するのか ────────────────────────────────────────────
 * 「この帖の本文が、チェーンに刻まれた全 54 帖の root の一部である」を、
 * **他の 53 帖を 1 バイトも見ずに**確かめる。
 *
 * 使うのは 3 つだけ:
 *   1. data NFT のアドレス (これだけ知っていればよい)
 *   2. 公開 RPC (誰でも使える)
 *   3. 公開 IPFS ゲートウェイ (誰でも使える)
 *
 * Ocean のノードも Aquarius も要らない。公開者を信用する必要もない。
 * **手元のファイルも使わない**ので、このリポジトリを持っていない人でも同じことができる。
 *
 * ── 手順 ────────────────────────────────────────────────────────
 *   a. チェーンから DDO を読む (平文なので復号不要)
 *   b. DDO の中の CID から、IPFS で本文を取る
 *   c. 取った本文をハッシュして、DDO の葉ハッシュと合うか見る
 *   d. DDO の中の経路 6 ハッシュで root まで畳む
 *   e. その root が CorpusAnchor に刻まれているか、チェーンで確かめる
 *
 * c が「本文がすり替わっていない」、d が「全体の一部である」、
 * e が「公開者以外にも見える形で記録されている」を担う。
 */
import {TOPIC as OCEAN_TOPIC} from '../lib/ocean.mjs';
import {TOPIC, decodeCorpusAnchored, bytesAt} from '../lib/abi.mjs';
import * as merkle from '../lib/merkle.mjs';
import {hex} from '../lib/sha.mjs';
import {selectChain} from '../lib/chains.mjs';
import {connect, getLogs} from '../lib/rpc.mjs';
import {c, rule, head, argOf, padTo} from '../lib/ui.mjs';
import {readJson, OUT} from '../lib/store.mjs';
import path from 'node:path';

let nftAddress = argOf('nft');
if (!nftAddress) {
  // 便宜のため。--nft を渡せば out/ を一切読まない
  const v = Number(argOf('volume', '1'));
  const vols = readJson(path.join(OUT, 'volumes.json'), 'node scripts/16-publish-volumes.mjs --send');
  nftAddress = vols.volumes[v]?.nft;
  if (!nftAddress) { console.error(c.ng(`第${v}帖はまだ発行されていません`)); process.exit(1); }
}

const chain = selectChain('sepolia');
const conn = await connect(chain);

rule('第三者として 1 帖を検証する');
console.log(`  data NFT   ${nftAddress}`);
console.log(`  ${c.dim('知っているのはこのアドレスだけ。手元のファイルは読みません。')}`);

// ── a. チェーンから DDO ─────────────────────────────────────────
head('a. チェーンからメタデータを読む');
/**
 * 無料の公開 RPC は 1 回 50,000 ブロックまでしか受けない。
 * どこから探すか分からないので、直近から 50,000 ブロックずつ遡る (上限つき)。
 * MetadataCreated と MetadataUpdated の両方を見て、いちばん新しいものを取る。
 */
const head_ = Number(BigInt(await conn.call('eth_blockNumber', [])));
let logs = [];
for (let i = 0; i < 8 && !logs.length; i++) {
  const to = head_ - i * 50000;
  const from = Math.max(0, to - 49999);
  for (const topic of [OCEAN_TOPIC.MetadataCreated, OCEAN_TOPIC.MetadataUpdated]) {
    const got = await getLogs(conn, {address: nftAddress, topics: [topic],
      fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16)}).catch(() => []);
    logs.push(...got);
  }
  if (from === 0) break;
}
logs.sort((a, b) => parseInt(a.blockNumber, 16) - parseInt(b.blockNumber, 16));
if (!logs.length) { console.error(c.ng('  メタデータが見つかりません')); process.exit(1); }
const l = logs[logs.length - 1];
const flags = bytesAt(l.data, 2);
const encrypted = (flags[0] & 2) !== 0;
console.log(`  flags      0x${flags.toString('hex')}  ${encrypted ? c.ng('暗号化あり → ノードに頼むしかない') : c.ok('暗号化なし → そのまま読める')}`);
if (encrypted) process.exit(1);
const ddo = JSON.parse(bytesAt(l.data, 3).toString('utf8'));
const ai = ddo.metadata.additionalInformation;
console.log(`  名前        ${ddo.metadata.name}`);
console.log(`  ライセンス   ${ddo.metadata.license}`);
console.log(`  本文の在り処  ${ai.ipfsUri}`);

// ── b. IPFS から本文 ────────────────────────────────────────────
head('b. 本文を公開ゲートウェイから取る');
let body = null;
for (const g of ['https://ipfs.io', 'https://ipfs.filebase.io', 'https://gateway.pinata.cloud']) {
  try {
    const r = await fetch(`${g}/ipfs/${ai.ipfsCid}`, {signal: AbortSignal.timeout(45000)});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    body = Buffer.from(await r.arrayBuffer());
    console.log(`  ${padTo(new URL(g).host, 18)} ${c.ok(`${body.length.toLocaleString('en-US')} バイト取得`)}`);
    break;
  } catch (e) {
    console.log(`  ${padTo(new URL(g).host, 18)} ${c.ng(String(e.message).slice(0, 40))}`);
  }
}
if (!body) { console.error(c.ng('  どのゲートウェイからも取れませんでした')); process.exit(1); }

// ── c. 本文が葉ハッシュと合うか ─────────────────────────────────
head('c. 取った本文が、申告どおりのものか');
const leaf = '0x' + hex(merkle.leafHash(body));
const leafOk = leaf.toLowerCase() === ai.leafHash.toLowerCase();
console.log(`  計算した葉   ${leaf}`);
console.log(`  DDO の葉    ${ai.leafHash}`);
console.log(`  ${leafOk ? c.ok('一致 — 本文はすり替わっていない') : c.ng('食い違う')}`);

// ── d. 経路をたどって root へ ───────────────────────────────────
head(`d. 経路 ${ai.inclusionProof.length} ハッシュで root まで畳む`);
const proofOk = merkle.verify(body, ai.leafIndex, ai.treeSize,
  ai.inclusionProof.map((h) => Buffer.from(h.slice(2), 'hex')),
  Buffer.from(ai.chapterRoot.slice(2), 'hex'));
console.log(`  葉の位置     ${ai.leafIndex} / ${ai.treeSize}`);
console.log(`  渡した量     ${ai.inclusionProof.length * 32} バイト  ${c.dim(`(本文 ${body.length.toLocaleString('en-US')} バイトの ${Math.round(body.length / (ai.inclusionProof.length * 32))} 分の 1)`)}`);
console.log(`  行き着いた root ${ai.chapterRoot}`);
console.log(`  ${proofOk ? c.ok('到達した — この帖は全 54 帖の一部である') : c.ng('到達しない')}`);
console.log(`  ${c.dim('他の 53 帖は 1 バイトも見ていません')}`);

// ── e. その root がチェーンに刻まれているか ─────────────────────
head('e. その root が本当に刻まれているか');
/**
 * **DDO が起点のブロックを教えてくれる。** これが無いと 780 万ブロックを
 * 舐めることになり、無料の公開 RPC では辿れない (第1帖で実際に詰まった)。
 */
const anchorFrom = ai.corpusAnchorFromBlock ?? Math.max(0, head_ - 49999);
if (!ai.corpusAnchorFromBlock) {
  console.log(`  ${c.warn('DDO に起点のブロックがありません。直近 50,000 ブロックだけ見ます')}`);
}
const anchorLogs = await getLogs(conn, {address: ai.corpusAnchor,
  topics: [TOPIC.CorpusAnchored, null, ai.chapterRoot],
  fromBlock: '0x' + anchorFrom.toString(16),
  toBlock: '0x' + Math.min(head_, anchorFrom + 49999).toString(16)});
const anchors = anchorLogs.map(decodeCorpusAnchored);
console.log(`  CorpusAnchor ${ai.corpusAnchor}`);
console.log(`  この root の記録  ${anchors.length} 件`);
for (const a of anchors) {
  console.log(`    ${c.dim(`block ${a.blockNumber}  ${a.observer.slice(0, 10)}…  ${a.sourceUri.slice(0, 46)}`)}`);
}
const observers = [...new Set(anchors.map((a) => a.observer.toLowerCase()))];
console.log(`  刻んだ人     ${observers.length} 人`);
if (observers.length === 1) {
  console.log(`  ${c.warn('公開者ひとりだけ。独立した第三者が刻めば、この行の意味が強くなります')}`);
}

// ── まとめ ──────────────────────────────────────────────────────
head('結果');
const all = [
  ['メタデータを復号なしで読めた', !encrypted],
  ['本文を公開ゲートウェイから取れた', body !== null],
  ['本文が申告どおりだった', leafOk],
  ['全 54 帖の一部だと確かめられた', proofOk],
  ['その root がチェーンに刻まれていた', anchors.length > 0],
];
for (const [label, ok] of all) console.log(`  ${ok ? c.ok('ok') : c.ng('NG')}  ${label}`);
console.log('');
console.log(`  ${c.dim('使ったもの: data NFT のアドレス 1 つ / 公開 RPC / 公開 IPFS ゲートウェイ')}`);
console.log(`  ${c.dim('使わなかったもの: Ocean のノード / Aquarius / 公開者への信頼 / 手元のファイル')}`);
process.exit(all.every(([, ok]) => ok) ? 0 : 1);
