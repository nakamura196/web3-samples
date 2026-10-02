/**
 * root と本文の在り処を繋ぐ。**既定では送りません。**
 *
 *   op run --env-file=.env.local -- node scripts/09-link.mjs           下見
 *   op run --env-file=.env.local -- node scripts/09-link.mjs --send    送る
 *
 * ── なぜもう一度刻むのか ────────────────────────────────────────
 * 07-sepolia.mjs で刻んだ記録の sourceUri は GitHub を指している。
 *
 *   sourceUri = https://github.com/kouigenjimonogatari/…/tree/6328fa3b…
 *
 * これは **会社が持つ URL** で、GitHub が消えれば行き先が消える。root は
 * 「本文が変わっていないこと」しか言わないので、本文が消えたら
 * 指紋だけが残って本人がいない状態になる。
 *
 * 08-ipfs.mjs で本文を IPFS に載せ、CID が公開ゲートウェイから引けることを
 * 確かめた。今度はその CID を sourceUri にして刻む。
 *
 *   sourceUri = ipfs://bafybeihheff…
 *
 * CID は**内容から計算された住所**なので、誰がどこで配っていても同じ値になる。
 * Filebase がやめても、他の誰かが持っていれば同じ住所で引ける。
 * 「行き先が特定の会社に依存しない」状態にするのがこの 1 手である。
 *
 * ── 上書きではなく、足す ────────────────────────────────────────
 * CorpusAnchor は状態変数を持たないので、前の記録は消えない。
 * 同じ root に対して sourceUri の違う記録が **2 つ並ぶ**ことになる。
 * どちらが正しいかではなく、**両方の場所にあった**という事実が残る。
 */
import {SIG, TOPIC, encodeCall, decodeCorpusAnchored} from '../lib/abi.mjs';
import {selectChain} from '../lib/chains.mjs';
import {connect, waitReceipt, getLogs, gasUsed, sendSigned,
  nonceOf, balanceOf, baseFee, feePaid, formatEth} from '../lib/rpc.mjs';
import {addressOf, signTransaction, feesFrom} from '../lib/tx.mjs';
import {readCorpusOut, readJson, writeJson, OUT, rel} from '../lib/store.mjs';
import {c, rule, head, padTo} from '../lib/ui.mjs';
import path from 'node:path';
import fs from 'node:fs';

const send = process.argv.includes('--send');
const verifyOnly = process.argv.includes('--verify');   // 送らずに読み直すだけ

const priv = process.env.SEPOLIA_PRIVATE_KEY;
if (!priv || priv.startsWith('op://')) {
  console.error(c.ng('SEPOLIA_PRIVATE_KEY がありません (op run を通していますか)'));
  console.error('  op run --env-file=.env.local -- node scripts/09-link.mjs');
  process.exit(1);
}
const me = addressOf(priv);

const sepolia = readJson(path.join(OUT, 'sepolia.json'), 'node scripts/07-sepolia.mjs --send');
const ipfs = readJson(path.join(OUT, 'ipfs.json'), 'node scripts/08-ipfs.mjs --upload');
const corpus = readCorpusOut();

if (!ipfs.uploaded) {
  console.error(c.ng('out/ipfs.json が「上げていない」状態です。'));
  console.error('  先に op run --env-file=.env.local -- node scripts/08-ipfs.mjs --upload');
  process.exit(1);
}

const chain = selectChain('sepolia');
const conn = await connect(chain);
const IPFS_URI = `ipfs://${ipfs.directory.cid}`;

rule(send ? 'root と本文の在り処を繋ぐ' : 'root と本文の在り処を繋ぐ — 下見 (送りません)');
console.log(`  チェーン       ${chain.name} (chainId ${chain.chainId})`);
console.log(`  CorpusAnchor  ${sepolia.corpusAnchor}  ${c.dim('(配置済みのものを再利用)')}`);
if (!send) console.log(`  ${c.dim('--send を付けるまで、1 バイトも送りません。')}`);

head('行き先を差し替える');
console.log(`  いままで  ${corpus.source.sourceUri}`);
console.log(`            ${c.dim('↑ GitHub が消えたら、指す先が消える')}`);
console.log(`  これから  ${IPFS_URI}`);
console.log(`            ${c.dim('↑ 内容から決まる住所。誰が配っていても同じ値になる')}`);
console.log('');
console.log(`  公開ゲートウェイでの確認 (08-ipfs.mjs 実行時)`);
for (const g of ipfs.gateways ?? []) {
  console.log(`    ${padTo(g.gateway, 16)} ${g.ok ? c.ok('取れて CID も一致') : c.ng(g.error ?? '失敗')}`);
}

const capturedAt = Math.floor(Date.parse(corpus.capturedAt) / 1000);
const trees = [
  {key: 'chapter', label: '54 帖', ...corpus.trees.chapter},
  {key: 'item', label: '25,065 行', ...corpus.trees.item},
];
const ARG_TYPES = ['bytes32', 'bytes32', 'uint64', 'uint32', 'string', 'string'];

const bal = await balanceOf(conn, me);
const nonce = await nonceOf(conn, me);
const fees = feesFrom(await baseFee(conn));

head('送るもの');
const plan = trees.map((t, i) => {
  const data = encodeCall(SIG.anchor, ARG_TYPES,
    [corpus.corpusId, t.root, capturedAt, t.treeSize, IPFS_URI, t.spec]);
  return {label: `${t.label} を ipfs:// で刻む`, tree: t,
    tx: {to: sepolia.corpusAnchor, value: 0n, data}, gas: 120000n, index: i};
});
let totalGas = 0n;
for (const p of plan) {
  const signed = signTransaction({...p.tx, chainId: BigInt(chain.chainId),
    nonce: nonce + BigInt(p.index), gas: p.gas, ...fees}, priv);
  totalGas += p.gas;
  console.log(`  ${padTo(p.label, 30)} ${String((p.tx.data.length - 2) / 2).padStart(4)} バイト  ` +
    c.dim(signed.hash.slice(0, 18) + '…'));
}
console.log('');
console.log(`  ${c.dim(`sourceUri が 114 → ${IPFS_URI.length} 文字に縮むので、前より少し安くなります`)}`);
console.log(`  残高  ${formatEth(bal)}  →  だいたい ${formatEth(totalGas * (fees.maxFeePerGas / 2n))} 使います`);

if (!send && !verifyOnly) {
  console.log('');
  console.log(c.warn('  下見なので、ここで終わります。何も送っていません。'));
  process.exit(0);
}

const records = [];
if (send) {
  head('送ります');
  for (const p of plan) {
    const sent = await sendSigned(conn, {...p.tx, gas: p.gas, ...fees}, priv);
    const receipt = await waitReceipt(conn, sent.hash, {tries: 120, intervalMs: 2000});
    const ok = receipt.status === '0x1';
    console.log(`  ${padTo(p.label, 30)} ${String(gasUsed(receipt)).padStart(7)} ガス  ` +
      `${ok ? c.ok('成功') : c.ng('失敗')}  ${c.dim(chain.explorer + '/tx/' + sent.hash)}`);
    if (!ok) process.exit(1);
    records.push({tree: p.tree.key, txHash: sent.hash, gas: gasUsed(receipt),
      feeWei: feePaid(receipt).toString(), block: parseInt(receipt.blockNumber, 16)});
  }
}

// ── 読み直す。同じ root に 2 つの行き先が並んでいるはず ─────────
head('チェーンから読み直す');
/**
 * fromBlock を省くと 0 から探しにいって落ちる。無料の公開 RPC は
 * **1 回 50,000 ブロックまで**しか受けない (lib/chains.mjs に実測を書いてある)。
 * CorpusAnchor が置かれたブロックより前にこのログは存在しないので、そこから読む。
 */
const deployBlock = Math.min(...sepolia.transactions.map((t) => t.block));
const logs = await getLogs(conn, {address: sepolia.corpusAnchor, topics: [TOPIC.CorpusAnchored],
  fromBlock: '0x' + deployBlock.toString(16)});
const events = logs.map(decodeCorpusAnchored);
console.log(`  CorpusAnchored  ${events.length} 件`);
for (const t of trees) {
  const mine = events.filter((e) => e.root.toLowerCase() === t.root.toLowerCase());
  console.log(`  ${padTo(t.label, 12)} ${mine.length} 件の記録`);
  for (const e of mine) console.log(`      ${c.dim(e.sourceUri)}`);
}
const hasIpfs = trees.every((t) => events.some(
  (e) => e.root.toLowerCase() === t.root.toLowerCase() && e.sourceUri === IPFS_URI));
console.log(`  ${hasIpfs ? c.ok('2 本とも ipfs:// の記録が入りました') : c.ng('入っていません')}`);

const spent = records.reduce((n, r) => n + BigInt(r.feeWei), 0n);
head('結果');
if (records.length) console.log(`  払った手数料  ${formatEth(spent)}`);
console.log(`  残高          ${formatEth(await balanceOf(conn, me))}`);

// --verify は読み直すだけ。送信済みの記録がある link.json を壊さない
const linkFile = path.join(OUT, 'link.json');
if (verifyOnly && !records.length && fs.existsSync(linkFile)) {
  console.log(`  ${c.dim('out/link.json は既にあります。上書きしません。')}`);
  process.exit(hasIpfs ? 0 : 1);
}
writeJson(linkFile, {
  generatedAt: new Date().toISOString(),
  corpusAnchor: sepolia.corpusAnchor,
  sourceUri: IPFS_URI,
  cid: ipfs.directory.cid,
  previousSourceUri: corpus.source.sourceUri,
  note: '同じ root に対して行き先の違う記録が 2 つ並ぶ。上書きはしていない',
  verifiedOnly: verifyOnly && !records.length,
  onChainRecords: events.filter((e) => e.sourceUri === IPFS_URI)
    .map((e) => ({root: e.root, treeSize: e.treeSize, tx: e.txHash, block: e.blockNumber})),
  transactions: records,
  feeWeiTotal: spent.toString(),
  caveat: 'IPFS に載ったことは「消えない」を意味しない。Filebase がやめれば取れなくなる',
});
console.log(`  書き出し      ${rel(linkFile)}`);
