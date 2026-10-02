/**
 * ヘッドレス検証:  npm run verify
 *
 * UI を通さずに 6 ステップを Testnet 上で実際に走らせ、
 * すべて tesSUCCESS になること・残高が期待どおり動くことを確認する。
 * ブラウザ側の不具合か XRPL 側の不具合かを切り分けるための足場。
 */
import { getClient, disconnect, xrpBalance, trustLines, orderBook, explorerAccount, findRoutes, CURRENCY } from '../src/lib/ledger.ts';
import * as g from '../src/lib/scenario.ts';

const c = await getClient();
const t0 = Date.now();
console.log('connected to testnet');

const actors = await g.createActors(c, (m) => console.log('  ', m));
console.log(`funded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const receipts: g.Receipt[] = [];
receipts.push(await g.enableIssuance(c, actors));
receipts.push(...(await g.openTrustLines(c, actors)));
receipts.push(await g.issueNote(c, actors));
receipts.push(await g.listOnDex(c, actors));
console.log('board before settle:', await orderBook(c, actors.kuramoto.wallet.address));
receipts.push(await g.takeOffer(c, actors));

console.log('\n--- receipts ---');
let fees = 0;
for (const r of receipts) {
  fees += r.feeDrops;
  console.log(`${r.type.padEnd(12)} ${r.result} ledger=${r.ledgerIndex} fee=${r.feeDrops}drops  ${r.summary}`);
}
console.log(`total fee: ${fees} drops = ${fees / 1_000_000} XRP`);

console.log('\n--- balances ---');
for (const role of ['kuramoto', 'han', 'nakagai'] as const) {
  const a = actors[role];
  const lines = await trustLines(c, a.wallet.address);
  console.log(
    `${role.padEnd(9)} ${await xrpBalance(c, a.wallet.address)} XRP  ` +
      lines.map((l) => `${l.balance} ${l.currency}`).join(', '),
  );
  console.log(`          ${explorerAccount(a.wallet.address)}`);
}
console.log('\nboard after settle:', await orderBook(c, actors.kuramoto.wallet.address));

// 経路探索: 米仲買が XRP を出して、蔵元に 5 石ぶんを届ける (= 切手の償還) 経路
const routes = await findRoutes(c, actors.nakagai.wallet.address, actors.kuramoto.wallet.address, {
  currency: CURRENCY,
  issuer: actors.kuramoto.wallet.address,
  value: '5',
});
console.log('routes nakagai -> kuramoto (5 KOK):', JSON.stringify(routes, null, 2));
console.log(`total elapsed ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await disconnect();
