/**
 * **本物の Sepolia に出す。** ここから先は公開チェーンで、取り消せない。
 *
 *   op run --env-file=.env.local -- node scripts/07-sepolia.mjs          下見 (送らない)
 *   op run --env-file=.env.local -- node scripts/07-sepolia.mjs --send   実際に送る
 *
 * ── ここまでと何が違うのか ──────────────────────────────────────
 * 02-anchor.mjs はローカルの anvil に送っていた。鍵は anvil が持ち、署名も
 * anvil がしていた。取り消したければ anvil を再起動すれば消えた。
 *
 * ここでは鍵を手元で持ち (1Password から op run が注入する)、署名を
 * lib/tx.mjs が作り、`eth_sendRawTransaction` で送る。**消せない。**
 *
 * ── 既定では送らない ────────────────────────────────────────────
 * 04-permanence.mjs と同じ考え方で、既定は下見にしてある。署名済みの
 * バイト列まで作り、いくらかかるかを出して、送らずに終わる。
 * `--send` を付けたときだけ送る。
 *
 * ── 公開者ひとりで刻んでも足りない ──────────────────────────────
 * 02-anchor.mjs は 3 人に刻ませていた。ここで刻めるのは鍵を持っている 1 人だけである。
 * README の結論のとおり、**公開者が自分で刻むだけならチェーンは要らない**
 * (`git tag -s` で足りる)。ここで確かめているのは「仕組みが公開チェーンで動くこと」
 * であって、「消せない記録ができたこと」ではない。そこは混ぜない。
 */
import {SIG, TOPIC, encodeCall, decodeCorpusAnchored} from '../lib/abi.mjs';
import {selectChain} from '../lib/chains.mjs';
import {connect, waitReceipt, getLogs, gasUsed, sendSigned,
  nonceOf, balanceOf, baseFee, estimateGas, feePaid, formatEth} from '../lib/rpc.mjs';
import {addressOf, signTransaction} from '../lib/tx.mjs';
import {feesFrom} from '../lib/tx.mjs';
import {readCorpusOut, writeJson, OUT, rel} from '../lib/store.mjs';
import {c, rule, head, padTo} from '../lib/ui.mjs';
import fs from 'node:fs';
import path from 'node:path';

const send = process.argv.includes('--send');
/**
 * **既にある CorpusAnchor に追記する。**
 *
 *   op run ... node scripts/07-sepolia.mjs --to-existing          下見
 *   op run ... node scripts/07-sepolia.mjs --to-existing --send   追記
 *
 * 素材の版が変わるたびに新しい契約を配置すると、記録が契約ごとに散らばる。
 * 「この資料の root はどこを見れば揃うのか」が answerable でなくなり、
 * 第三者は契約を全部知っていないと検証できない。**追記先は 1 つに保つ。**
 *
 * 契約は状態変数を持たず、`anchor()` はイベントを出すだけなので、
 * 何度でも追記できる。前の版の記録も残る。
 */
const toExisting = process.argv.includes('--to-existing');

// ── 鍵を受け取る ────────────────────────────────────────────────
const priv = process.env.SEPOLIA_PRIVATE_KEY;
if (!priv) {
  console.error(c.ng('SEPOLIA_PRIVATE_KEY がありません。'));
  console.error('  op run --env-file=.env.local -- node scripts/07-sepolia.mjs');
  process.exit(1);
}
if (priv.startsWith('op://')) {
  console.error(c.ng('op:// 参照のまま渡ってきています (op run を通していません)。'));
  console.error('  op run --env-file=.env.local -- node scripts/07-sepolia.mjs');
  process.exit(1);
}
const me = addressOf(priv);

// ── どこに送るのかを必ず見せる ──────────────────────────────────
const chain = selectChain('sepolia');
const conn = await connect(chain);

rule(send ? '本物の Sepolia に送る' : '本物の Sepolia — 下見 (何も送りません)');
console.log(`  チェーン   ${chain.name} (chainId ${chain.chainId})`);
console.log(`  RPC        ${conn.url}`);
console.log(`  ${c.warn('公開チェーンです。刻んだものは取り消せません。')}`);
if (!send) console.log(`  ${c.dim('--send を付けるまで、1 バイトも送りません。')}`);

const bal = await balanceOf(conn, me);
const nonce = await nonceOf(conn, me);
const base = await baseFee(conn);
const fees = feesFrom(base);

head('送る人');
console.log(`  アドレス   ${me}`);
console.log(`  残高       ${formatEth(bal)}`);
console.log(`  nonce      ${nonce}`);
console.log(`  基本手数料  ${(Number(base) / 1e9).toFixed(4)} gwei`);
console.log(`  上限        ${(Number(fees.maxFeePerGas) / 1e9).toFixed(4)} gwei (基本の 2 倍 + 優先 1 gwei)`);

// ── 何を刻むか ──────────────────────────────────────────────────
const corpus = readCorpusOut();
const capturedAt = Math.floor(Date.parse(corpus.capturedAt) / 1000);
const trees = [
  {key: 'chapter', label: '54 帖', ...corpus.trees.chapter},
  {key: 'item', label: '25,065 行', ...corpus.trees.item},
];
const ARG_TYPES = ['bytes32', 'bytes32', 'uint64', 'uint32', 'string', 'string'];

head('刻む中身');
console.log(`  資料       ${corpus.corpusUri}`);
console.log(`  corpusId   ${corpus.corpusId}`);
console.log(`  素材       ${corpus.source.commit}`);
for (const t of trees) {
  console.log(`  ${padTo(t.label, 12)} ${t.root}  (treeSize ${t.treeSize.toLocaleString('en-US')})`);
}

// ── 送るものを組み立てる ────────────────────────────────────────
const artifact = JSON.parse(fs.readFileSync(
  path.join(OUT, '..', 'contracts/out/CorpusAnchor.sol/CorpusAnchor.json'), 'utf8'));
const deployData = artifact.bytecode.object;

const plan = [];
let willBeAt;

if (toExisting) {
  // 既にある契約に追記する。out/sepolia.json に住所が残っている
  const before = JSON.parse(fs.readFileSync(path.join(OUT, 'sepolia.json'), 'utf8'));
  willBeAt = before.corpusAnchor;
  const code = await conn.call('eth_getCode', [willBeAt, 'latest']);
  if (!code || code === '0x') {
    console.error(c.ng(`${willBeAt} にコードがありません。追記先が違います`));
    process.exit(1);
  }
  console.log(`  ${c.ok('既にある CorpusAnchor に追記します')}  ${willBeAt}`);
  console.log(`  ${c.dim(`コード ${(code.length - 2) / 2} バイト`)}`);
} else {
  plan.push({
    label: 'CorpusAnchor を配置',
    tx: {to: '', value: 0n, data: deployData},
    gas: await estimateGas(conn, {from: me, to: '', data: deployData, value: 0n}) * 125n / 100n,
  });
  // 配置先は nonce から決まる (keccak256(rlp([sender, nonce]))[12:])。
  // 下見でも「どこにできるか」を先に出せる
  const {keccak256} = await import('../lib/keccak.mjs');
  const {encode} = await import('../lib/rlp.mjs');
  willBeAt = '0x' + keccak256(encode([me, nonce])).subarray(12).toString('hex');
}

for (const t of trees) {
  plan.push({
    label: `${t.label} の root を刻む`,
    tx: {to: willBeAt, value: 0n,
      data: encodeCall(SIG.anchor, ARG_TYPES,
        [corpus.corpusId, t.root, capturedAt, t.treeSize, corpus.source.sourceUri, t.spec])},
    // 配置済みなら見積もれる。まだなら anvil の実測 32,360 に余裕を見た固定値
    gas: 120000n,
    tree: t,
  });
}

head('送るもの');
let totalGas = 0n;
for (const p of plan) {
  const signed = signTransaction(
    {...p.tx, chainId: BigInt(chain.chainId), nonce: nonce + BigInt(plan.indexOf(p)),
      gas: p.gas, ...fees}, priv);
  p.signed = signed;
  totalGas += p.gas;
  console.log(`  ${padTo(p.label, 24)} ${String(p.gas).padStart(8)} ガス上限  ` +
    `${String((signed.raw.length - 4) / 2).padStart(5)} バイト  ${c.dim(signed.hash.slice(0, 18) + '…')}`);
}
console.log(`  ${c.dim(`${toExisting ? '追記先' : 'できる'} CorpusAnchor の住所  ${willBeAt}`)}`);

const worst = totalGas * fees.maxFeePerGas;
const likely = totalGas * (base + fees.maxPriorityFeePerGas);
head('費用');
console.log(`  ガス上限の合計  ${totalGas.toLocaleString('en-US')}`);
console.log(`  だいたい        ${formatEth(likely)}`);
console.log(`  最悪            ${formatEth(worst)}  (上限まで使い、上限の手数料で取り込まれた場合)`);
console.log(`  残高で足りるか   ${bal > worst ? c.ok('足ります') : c.ng('足りません')}`);

if (!send) {
  console.log('');
  console.log(c.warn('  下見なので、ここで終わります。何も送っていません。'));
  console.log(c.dim('  送るときは --send を付けてください。'));
  process.exit(0);
}

// ── ここから先は取り消せない ────────────────────────────────────
head('送ります');
const records = [];
/**
 * 追記モードでは配置の取引が無いので、ここで先に決めておく。
 * **これを忘れて null のまま getLogs に渡し**、公開 RPC が
 * 「アドレスを指定してください」で断ってきた（書き込みは成功していたので、
 * 落ちたのは読み直しの側だけだった）。
 */
let anchorAddress = toExisting ? willBeAt : null;

for (const p of plan) {
  const sent = await sendSigned(conn, {...p.tx, gas: p.gas, ...fees}, priv);
  process.stdout.write(`  ${padTo(p.label, 24)} ${c.dim(sent.hash.slice(0, 18) + '…')} 取り込み待ち`);
  const receipt = await waitReceipt(conn, sent.hash, {tries: 120, intervalMs: 2000});
  const ok = receipt.status === '0x1';
  console.log(`\r  ${padTo(p.label, 24)} ${String(gasUsed(receipt)).padStart(8)} ガス  ` +
    `${ok ? c.ok('成功') : c.ng('失敗')}  ${c.dim(chain.explorer + '/tx/' + sent.hash)}`);
  if (!ok) {
    console.error(c.ng('  失敗したので止めます。'));
    process.exit(1);
  }
  if (receipt.contractAddress) {
    anchorAddress = receipt.contractAddress;
    if (anchorAddress.toLowerCase() !== willBeAt.toLowerCase()) {
      console.error(c.ng(`  予想した住所と違う: 予想 ${willBeAt} / 実際 ${anchorAddress}`));
      process.exit(1);
    }
  }
  records.push({label: p.label, tree: p.tree?.key ?? null, txHash: sent.hash,
    gas: gasUsed(receipt), feeWei: feePaid(receipt).toString(), block: parseInt(receipt.blockNumber, 16)});
}

// ── 書いた値を信じない。読み直す ────────────────────────────────
head('チェーンから読み直す');
const logs = await getLogs(conn, {address: anchorAddress, topics: [TOPIC.CorpusAnchored],
  fromBlock: '0x' + records[0].block.toString(16)});
const events = logs.map(decodeCorpusAnchored);
console.log(`  CorpusAnchored  ${events.length} 件`);
let mismatch = 0;
for (const t of trees) {
  const hit = events.find((e) => e.root.toLowerCase() === t.root.toLowerCase());
  const ok = hit && Number(hit.treeSize) === t.treeSize;
  if (!ok) mismatch++;
  console.log(`  ${padTo(t.label, 12)} ${ok ? c.ok('チェーン上の root が 01-digest と一致') : c.ng('一致しない')}`);
}
const observers = [...new Set(events.map((e) => e.observer.toLowerCase()))];
console.log(`  刻んだ人        ${observers.length} 人 ` +
  c.warn('(公開者のみ。独立した第三者はまだ 0 人)'));
console.log(`  ${c.dim(observers.join(' '))}`);

const spent = records.reduce((n, r) => n + BigInt(r.feeWei), 0n);
head('結果');
console.log(`  CorpusAnchor  ${anchorAddress}`);
console.log(`  ${chain.explorer}/address/${anchorAddress}`);
console.log(`  払った手数料    ${formatEth(spent)}`);
console.log(`  残高           ${formatEth(await balanceOf(conn, me))}`);

const out = {
  chain: {key: chain.key, name: chain.name, chainId: chain.chainId, rpc: conn.url,
    explorer: chain.explorer},
  note: '**本物の Sepolia**。取り消せない。鍵は 1Password にあり、ここには書かない',
  anchoredBy: me,
  corpusAnchor: anchorAddress,
  corpusId: corpus.corpusId,
  sourceCommit: corpus.source.commit,
  trees: Object.fromEntries(trees.map((t) => [t.key,
    {root: t.root, treeSize: t.treeSize, spec: t.spec}])),
  transactions: records,
  feeWeiTotal: spent.toString(),
  independentWitnesses: 0,
  caveat: '公開者ひとりが刻んだだけ。README の結論どおり、これだけならチェーンは要らない',
};
writeJson(path.join(OUT, 'sepolia.json'), out);
console.log(`  書き出し       ${rel(path.join(OUT, 'sepolia.json'))}`);
console.log('');
console.log(c.ok('  終わりました。'));
