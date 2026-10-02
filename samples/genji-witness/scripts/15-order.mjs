/**
 * 研究者役が資料を「注文」する。**公開チェーンで、Ocean のノードを 1 度も呼ばずに。**
 *
 *   op run --env-file=.env.local -- node scripts/15-order.mjs           下見
 *   op run --env-file=.env.local -- node scripts/15-order.mjs --send    実行
 *
 * ── これで何を確かめるのか ──────────────────────────────────────
 * 06-ocean.mjs でフォークの中では確かめた 2 つを、本物のチェーンで確かめる。
 *
 *   1. **無料なら Provider の署名が要らない。**
 *      _checkProviderFee は手数料が 0 でも必ず ecrecover を呼ぶ。ただし v が
 *      27/28 でないとき ecrecover は 0x0 を返し、providerFeeAddress も 0x0 なら
 *      等しくなって検査を通る。**Ocean のサーバが 1 台も動いていなくても注文できる。**
 *
 *   2. **券は持てない。** 出す → 記録する → その場で焼く、が 1 つの取引に閉じる。
 *      残高は前も後も 0 のまま。売買できる「持ち物」は存在せず、
 *      残るのは「使った」という記録だけ。
 *
 * ── 正直に書いておくこと ────────────────────────────────────────
 * 研究者役の鍵も**同じ人が持っている**。だからこれは仕組みの確認であって、
 * 「第三者が使った」ことにはならない。out/order.json に selfControlled: true を残す。
 * CorpusAnchor の独立した証人の数はこれでは増えない (増やしてはいけない)。
 */
import {SIG, TYPES, TOPIC, SEPOLIA, orderParams} from '../lib/ocean.mjs';
import {encodeCall, topicToAddress, wordAt} from '../lib/abi.mjs';
import {selector} from '../lib/keccak.mjs';
import {selectChain} from '../lib/chains.mjs';
import {connect, waitReceipt, gasUsed, sendSigned, balanceOf, baseFee,
  estimateGas, ethCall, feePaid, formatEth, getLogs} from '../lib/rpc.mjs';
import {addressOf, feesFrom} from '../lib/tx.mjs';
import {readJson, writeJson, OUT, rel} from '../lib/store.mjs';
import {c, rule, head, padTo} from '../lib/ui.mjs';
import path from 'node:path';

const send = process.argv.includes('--send');
const n = (x) => Number(x).toLocaleString('en-US');

const pubPriv = process.env.SEPOLIA_PRIVATE_KEY;
const readerPriv = process.env.READER_PRIVATE_KEY;
for (const [k, v] of [['SEPOLIA_PRIVATE_KEY', pubPriv], ['READER_PRIVATE_KEY', readerPriv]]) {
  if (!v || v.startsWith('op://')) {
    console.error(c.ng(`${k} がありません (op run を通していますか)`));
    process.exit(1);
  }
}
const PUBLISHER = addressOf(pubPriv);
const READER = addressOf(readerPriv);

const chain = selectChain('sepolia');
const conn = await connect(chain);
const publish = readJson(path.join(OUT, 'publish.json'), 'node scripts/11-publish.mjs --send');
const DT = publish.datatoken;

rule(send ? '研究者役が注文する' : '研究者役が注文する — 下見 (送りません)');
console.log(`  ${c.warn('研究者役の鍵も同じ人が持っています。「第三者が使った」ことにはなりません。')}`);
console.log(`  ${c.dim('ここで確かめるのは「Ocean のサーバなしで注文が通るか」です。')}`);

const dtBalance = async (who) =>
  BigInt(await ethCall(conn, DT, selector('balanceOf(address)') + who.slice(2).padStart(64, '0')));
const totalSupply = async () => BigInt(await ethCall(conn, DT, selector('totalSupply()')));

head('登場人物');
console.log(`  公開者    ${PUBLISHER}  ${formatEth(await balanceOf(conn, PUBLISHER))}`);
console.log(`  研究者    ${READER}  ${formatEth(await balanceOf(conn, READER))}`);
console.log(`  datatoken ${DT}`);

head('注文する前の状態');
console.log(`  研究者の券   ${await dtBalance(READER)} 枚`);
console.log(`  存在する券   ${await totalSupply()} 枚`);

const fees = feesFrom(await baseFee(conn));
const orderData = encodeCall(SIG.buyFromDispenserAndOrder, TYPES.buyFromDispenserAndOrder,
  [orderParams(READER, 0n), SEPOLIA.Dispenser]);

// 研究者にガス代が要る。無ければ公開者から送る
const readerBal = await balanceOf(conn, READER);
const NEED = 10n ** 16n;   // 0.01 ETH
head('研究者のガス代');
if (readerBal < NEED) {
  console.log(`  ${formatEth(readerBal)} しかないので、公開者から ${formatEth(NEED)} 送ります`);
} else {
  console.log(`  ${formatEth(readerBal)} あるので、送金は要りません`);
}

if (!send) {
  head('送るもの');
  console.log(`  ${padTo('研究者へのガス代', 30)} ${readerBal < NEED ? '21,000 ガス' : '(不要)'}`);
  console.log(`  ${padTo('buyFromDispenserAndOrder', 30)} ${c.dim('約 124,000 ガス (フォークでの実測)')}`);
  console.log(`  ${c.dim('providerFee はすべて 0。Ocean のノードに一切問い合わせません')}`);
  console.log('');
  console.log(c.warn('  下見なので、ここで終わります。何も送っていません。'));
  process.exit(0);
}

const records = [];
if (readerBal < NEED) {
  head('ガス代を送ります');
  const t = await sendSigned(conn, {to: READER, value: NEED, data: '0x', gas: 21000n, ...fees}, pubPriv);
  const rc = await waitReceipt(conn, t.hash, {tries: 120, intervalMs: 2000});
  console.log(`  ${formatEth(NEED)} → 研究者  ${rc.status === '0x1' ? c.ok('成功') : c.ng('失敗')}  ${c.dim(chain.explorer + '/tx/' + t.hash)}`);
  records.push({label: '研究者へガス代', txHash: t.hash, gas: gasUsed(rc)});
}

head('注文する — 出す → 記録する → 焼く');
let gas;
try {
  gas = await estimateGas(conn, {from: READER, to: DT, data: orderData}) * 130n / 100n;
} catch (e) {
  console.error(c.ng(`  見積もれません: ${e.message.slice(0, 100)}`));
  process.exit(1);
}
const sent = await sendSigned(conn, {to: DT, data: orderData, gas, ...fees}, readerPriv);
const rc = await waitReceipt(conn, sent.hash, {tries: 120, intervalMs: 2000});
if (rc.status !== '0x1') {
  console.error(c.ng(`  失敗 ${chain.explorer}/tx/${sent.hash}`));
  process.exit(1);
}
const started = rc.logs.filter((l) => l.topics[0] === TOPIC.OrderStarted);
const burns = rc.logs.filter((l) => l.topics[0] === TOPIC.Transfer
  && topicToAddress(l.topics[2]) === '0x0000000000000000000000000000000000000000');
const mints = rc.logs.filter((l) => l.topics[0] === TOPIC.Transfer
  && topicToAddress(l.topics[1]) === '0x0000000000000000000000000000000000000000');
console.log(`  ${n(gasUsed(rc))} ガス  ${c.dim(chain.explorer + '/tx/' + sent.hash)}`);
console.log(`  この 1 つの取引の中で:`);
console.log(`    券が出た (0x0 から来た移転)   ${mints.length} 件`);
console.log(`    注文が記録された (OrderStarted) ${started.length} 件`);
console.log(`    券が焼かれた (0x0 への移転)   ${burns.length} 件`);
records.push({label: '注文する', txHash: sent.hash, gas: gasUsed(rc)});

head('注文した後の状態');
const after = await dtBalance(READER);
const supply = await totalSupply();
console.log(`  研究者の券   ${after} 枚  ${after === 0n ? c.ok('← 0 に戻っている。券は在庫にならない') : c.ng('残っている')}`);
console.log(`  存在する券   ${supply} 枚  ${supply === 0n ? c.ok('← 誰も持っていない') : ''}`);
console.log('');
console.log(`  ${c.b('残ったのは「使った」という記録だけです。')}`);

head('Ocean のサーバを使ったか');
console.log(`  ${c.ok('1 度も呼んでいません。')}  ${c.dim('providerFee をすべて 0 にしたので、署名の検査を素通りしました')}`);

const spent = records.reduce((a, r) => a + 0n, 0n);
writeJson(path.join(OUT, 'order.json'), {
  generatedAt: new Date().toISOString(),
  chain: {chainId: chain.chainId, explorer: chain.explorer},
  selfControlled: true,
  caveat: '研究者役の鍵も公開者と同じ人が持っている。仕組みの確認であって、第三者の利用ではない',
  publisher: PUBLISHER, reader: READER, datatoken: DT,
  transactions: records,
  inOneTransaction: {minted: mints.length, orderStarted: started.length, burned: burns.length},
  readerBalanceAfter: after.toString(),
  totalSupplyAfter: supply.toString(),
  oceanServersUsed: [],
});
console.log('');
console.log(`  書き出し  ${rel(path.join(OUT, 'order.json'))}`);
