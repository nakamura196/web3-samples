/**
 * 実測: DefaultRipple を立てないと、何が・どのエラーで落ちるのか。
 *
 *   node scripts/no-default-ripple.ts
 *
 * 教材には「② を飛ばすと ⑥ の約定が tecPATH_DRY で落ちる」と書いてある。
 * 一方 xrpl.org の OfferCreate のエラー一覧に tecPATH_DRY は無く、
 * rippled のソースでも板の約定は rippling の制約を受けないように読める。
 * ドキュメントとソースの読みだけでは決着しないので、Testnet で実際に確かめる。
 *
 * ② だけを飛ばして ③④⑤ を通し、
 *   A) 板の約定 (OfferCreate による cross)
 *   B) 保有者どうしの直接送金 (Payment)
 * のそれぞれが成功するのか、するならどの結果コードになるのかを見る。
 */
import { Client, Wallet, xrpToDrops, type OfferCreate, type Payment } from 'xrpl';
import { CURRENCY, disconnect, getClient, orderBook, trustLines } from '../src/lib/ledger.ts';
import * as g from '../src/lib/scenario.ts';

/** 結果コードだけを取り出す。失敗しても投げずに返す */
async function trySubmit(
  c: Client,
  wallet: Wallet,
  tx: OfferCreate | Payment,
  label: string,
): Promise<string> {
  try {
    const res = await c.submitAndWait(tx, { autofill: true, wallet });
    const meta = typeof res.result.meta === 'object' ? res.result.meta : undefined;
    const code =
      (meta && 'TransactionResult' in meta ? meta.TransactionResult : undefined) ?? 'unknown';
    console.log(`  ${label.padEnd(28)} -> ${code}`);
    return code;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  ${label.padEnd(28)} -> 例外: ${msg}`);
    return `throw:${msg}`;
  }
}

const c = await getClient();
console.log('testnet に接続');

const actors = await g.createActors(c, (m) => console.log('  ', m));
const issuer = actors.kuramoto.wallet.address;

console.log('\n② DefaultRipple は「立てない」');

console.log('\n③ 信用線');
for (const r of await g.openTrustLines(c, actors)) console.log(`  TrustSet -> ${r.result}`);

console.log('\n④ 発行 (発行体 → 藩)');
try {
  const r = await g.issueNote(c, actors);
  console.log(`  Payment  -> ${r.result}`);
} catch (e) {
  console.log(`  Payment  -> 失敗: ${e instanceof Error ? e.message : e}`);
}

console.log('\n⑤ 板に出す (藩)');
try {
  const r = await g.listOnDex(c, actors);
  console.log(`  OfferCreate -> ${r.result}`);
} catch (e) {
  console.log(`  OfferCreate -> 失敗: ${e instanceof Error ? e.message : e}`);
}
console.log('  板:', await orderBook(c, issuer));

console.log('\n⑥-A 板の約定 (米仲買が反対注文を出す)');
const crossTx: OfferCreate = {
  TransactionType: 'OfferCreate',
  Account: actors.nakagai.wallet.address,
  TakerGets: xrpToDrops('5'),
  TakerPays: { currency: CURRENCY, issuer, value: '25' },
};
const crossCode = await trySubmit(c, actors.nakagai.wallet, crossTx, 'OfferCreate (cross)');

console.log('\n  約定後の残高:');
for (const role of ['han', 'nakagai'] as const) {
  const lines = await trustLines(c, actors[role].wallet.address);
  console.log(
    `    ${role.padEnd(8)} ${lines.map((l) => `${l.balance} ${l.currency}`).join(', ') || '(なし)'}`,
  );
}

console.log('\n⑥-B 保有者どうしの直接送金 (藩 → 米仲買)');
const payTx: Payment = {
  TransactionType: 'Payment',
  Account: actors.han.wallet.address,
  Destination: actors.nakagai.wallet.address,
  Amount: { currency: CURRENCY, issuer, value: '1' },
};
const payCode = await trySubmit(c, actors.han.wallet, payTx, 'Payment (holder→holder)');

console.log('\n=== 結論 ===');
console.log(`板の約定:       ${crossCode}`);
console.log(`保有者間の送金: ${payCode}`);
console.log(
  crossCode === 'tesSUCCESS'
    ? '→ DefaultRipple 無しでも板の約定は成立する。教材の「⑥ の約定が tecPATH_DRY で落ちる」は誤り。'
    : `→ DefaultRipple 無しだと板の約定も失敗する (${crossCode})。`,
);

await disconnect();
