/**
 * Ocean の**有料経路**を測る。06-ocean.mjs の続き。
 *
 *   前提: anvil --fork-url <sepolia> --fork-block-number 11568246 --port 8549
 *   使い方: node scripts/20-ocean-paid.mjs
 *
 * ── なぜ要るのか ────────────────────────────────────────────────
 * 06 では無料の Dispenser しか叩かなかった。そこから
 * 「datatoken は在庫にならない」と書いたが、これは入口 1 本だけを見た話だった。
 *
 * ocean.js の OrderUtils.ts を読むと、注文の経路は 4 通りに分岐している。
 *
 *   無料 / template 2,4 … buyFromDispenserAndOrder      1 取引
 *   無料 / template 1   … dispense → (待つ) → startOrder 2 取引
 *   有料 / template 2,4 … buyFromFreAndOrder            1 取引
 *   有料 / template 1   … buyDT → (待つ) → startOrder   2 取引
 *
 * template 1 の 2 本立ての経路では、利用者は取引と取引の間 **datatoken を保有する**。
 * しかも template 1 の startOrder は焼かずに公開者へ transfer する
 * (Enterprise だけが末尾で burn する)。
 *
 * ここで測るのは 2 つ。
 *   A. 有料 (template 2) の動きが、無料のときと同じ形か
 *   B. template 1 で、利用者の残高が本当に残るか  ← 「持てない」の反証
 */
import {SEPOLIA, SIG, TYPES, NO_PROVIDER_FEE, NO_CONSUME_MARKET_FEE,
  ercCreateData, orderParams} from '../lib/ocean.mjs';
import {keccak256} from '../lib/keccak.mjs';
import {encodeCall, encodeArgs, word, wordAt, topicToAddress} from '../lib/abi.mjs';
import {selectChain} from '../lib/chains.mjs';
import {connect, ethCall, sendTx, waitReceipt, gasUsed} from '../lib/rpc.mjs';
import {writeJson, rel, OUT} from '../lib/store.mjs';
import {c, rule, head} from '../lib/ui.mjs';
import path from 'node:path';

const PUBLISHER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const READER    = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const ONE = 10n ** 18n;
const PRICE = 10n * ONE;          // 1 券 = 10 OCEAN
const n = (v) => Number(v).toLocaleString('en-US');
const dt = (v) => (Number(BigInt(v)) / 1e18).toString();

// ── 追加で要る型とセレクタ (lib/ocean.mjs には無いもの) ────────────
const NFT_CREATE  = '(string,string,uint256,string,bool,address)';
const ERC_CREATE  = '(uint256,string[],address[],uint256[],bytes[])';
const FIXED_DATA  = '(address,address[],uint256[])';
const PROVIDER_FEE = '(address,address,uint256,uint8,bytes32,bytes32,uint256,bytes)';
const CONSUME_FEE  = '(address,address,uint256)';
const ORDER_PARAMS = `(address,uint256,${PROVIDER_FEE},${CONSUME_FEE})`;
const FRE_PARAMS   = '(address,bytes32,uint256,uint256,address)';

import {selector} from '../lib/keccak.mjs';
const S = {
  createNftWithErc20WithFixedRate:
    selector(`createNftWithErc20WithFixedRate(${NFT_CREATE},${ERC_CREATE},${FIXED_DATA})`),
  buyFromFreAndOrder: selector(`buyFromFreAndOrder(${ORDER_PARAMS},${FRE_PARAMS})`),
  startOrder: selector(`startOrder(address,uint256,${PROVIDER_FEE},${CONSUME_FEE})`),
  buyDT: selector('buyDT(bytes32,uint256,uint256,address,uint256)'),
  getAllowedSwapper: selector('getAllowedSwapper(bytes32)'),
  approve: selector('approve(address,uint256)'),
  erc20BalanceOf: selector('balanceOf(address)'),
  totalSupply: selector('totalSupply()'),
  dispense: selector('dispense(address,uint256,address)'),
  createDispenser: selector('createDispenser(address,uint256,uint256,bool,address)'),
  calcBaseInGivenOutDT: selector('calcBaseInGivenOutDT(bytes32,uint256,uint256)'),
  createERC20: selector('createERC20(uint256,string[],address[],uint256[],bytes[])'),
};

const pad = (a) => '0x' + BigInt(a).toString(16).padStart(64, '0');
const bal = async (conn, token, who) =>
  BigInt(await ethCall(conn, token, encodeCall(S.erc20BalanceOf, ['address'], [who])));

/** anvil の中で OCEAN を配る。残高マッピングのスロットは総当りで見つける */
async function fundBaseToken(conn, token, who, amount) {
  for (let slot = 0; slot <= 12; slot++) {
    const key = '0x' + keccak256(
      Buffer.from(pad(who).slice(2) + pad(slot).slice(2), 'hex')).toString('hex');
    await conn.call('anvil_setStorageAt', [token, key, pad(amount)]);
    if (await bal(conn, token, who) === amount) return slot;
  }
  throw new Error('OCEAN の残高スロットが見つかりませんでした');
}

async function expectRevert(label, fn) {
  try { await fn(); return {label, reverted: false, reason: null}; }
  catch (e) { return {label, reverted: true,
    reason: e.message.replace(/^execution reverted:?\s*/i, '').slice(0, 90)}; }
}

async function main() {
  const conn = await connect(selectChain('sepoliaFork'));
  const out = {chain: {}, fixedRate: {}, template1: {}, gas: {}};
  out.chain.forkedBlock = Number(BigInt(await conn.call('eth_blockNumber', [])));

  // EIP-7702 の委任が刺さっていると _safeMint が通らない (06 と同じ処置)
  for (const a of [PUBLISHER, READER]) await conn.call('anvil_setCode', [a, '0x']);

  rule(); head('有料経路 — 固定価格の交換所を付けて発行する');

  // ── 1. NFT + datatoken(template 2) + FixedRate を 1 回で作る ────────
  const fixedData = [
    SEPOLIA.FixedPrice,
    [SEPOLIA.Ocean, PUBLISHER, PUBLISHER, '0x' + '00'.repeat(20)], // baseToken, owner, marketFeeCollector, allowedSwapper
    [18n, 18n, PRICE, 0n, 1n], // btDecimals, dtDecimals, rate, marketFee, withMint
  ];
  const createTx = await sendTx(conn, {
    from: PUBLISHER, to: SEPOLIA.ERC721Factory,
    data: encodeCall(S.createNftWithErc20WithFixedRate, [NFT_CREATE, ERC_CREATE, FIXED_DATA], [
      ['校異源氏物語 TEI (有料)', 'KGENJI-P', 1n, 'https://kouigenjimonogatari.github.io/', true, PUBLISHER],
      ercCreateData({templateIndex: 2, dtName: 'Kouigenji Access (paid)', dtSymbol: 'KGACCP',
        owner: PUBLISHER, feeCollector: SEPOLIA.OPFCommunityFeeCollector}),
      fixedData,
    ]),
  });
  const cr = await waitReceipt(conn, createTx);
  out.gas.createWithFixedRate = gasUsed(cr);
  const nftLog = cr.logs.find((l) => l.topics[0] === TOPICS.NFTCreated);
  const nft = '0x' + wordAt(nftLog.data, 0).slice(26); // newTokenAddress は data の第 1 語
  const datatoken = topicToAddress(cr.logs.find((l) => l.topics[0] === TOPICS.TokenCreated).topics[1]);
  const exchangeId = '0x' + keccak256(
    Buffer.from(pad(SEPOLIA.Ocean).slice(2) + pad(datatoken).slice(2), 'hex')).toString('hex');
  out.fixedRate = {nft, datatoken, exchangeId, priceOcean: dt(PRICE)};
  console.log(`  data NFT   ${nft}`);
  console.log(`  datatoken  ${datatoken}`);
  console.log(`  exchangeId ${exchangeId}`);
  console.log(`  価格        ${dt(PRICE)} OCEAN / 1 券   (${n(gasUsed(cr))} ガス)`);

  // ── 2. 誰が交換所から買えるのか ────────────────────────────────
  const allowed = topicToAddress(await ethCall(conn, SEPOLIA.FixedPrice,
    encodeCall(S.getAllowedSwapper, ['bytes32'], [exchangeId])));
  out.fixedRate.allowedSwapper = allowed;
  console.log(`\n  allowedSwapper = ${allowed}`);
  console.log(`  ${allowed.toLowerCase() === datatoken.toLowerCase()
    ? '→ datatoken 自身。渡した 0x0 は無視された (createFixedRate が address(this) を書く)'
    : '→ 渡した値がそのまま入っている'}`);

  // ── 3. 利用者に OCEAN を配って、交換所から直接買えるか試す ──────
  const slot = await fundBaseToken(conn, SEPOLIA.Ocean, READER, 100n * ONE);
  out.fixedRate.oceanSlot = slot;
  console.log(`\n  研究者に 100 OCEAN を配った (残高スロット ${slot})`);

  const direct = await expectRevert('研究者が交換所から直接 buyDT', () =>
    sendTx(conn, {from: READER, to: SEPOLIA.FixedPrice,
      data: encodeCall(S.buyDT, ['bytes32', 'uint256', 'uint256', 'address', 'uint256'],
        [exchangeId, ONE, PRICE, '0x' + '00'.repeat(20), 0n])})
      .then((h) => waitReceipt(conn, h)));
  out.fixedRate.directBuy = direct;
  console.log(`  ${direct.reverted ? c.warn('revert した') : c.bad('通ってしまった')}  ${direct.reason ?? ''}`);

  // ── 4. 正規の経路: 必要額を訊く → approve → buyFromFreAndOrder ──
  const calc = await ethCall(conn, SEPOLIA.FixedPrice,
    encodeCall(S.calcBaseInGivenOutDT, ['bytes32', 'uint256', 'uint256'], [exchangeId, ONE, 0n]));
  const need = BigInt(wordAt(calc, 0));
  const opcFee = BigInt(wordAt(calc, 1));
  out.fixedRate.cost = {listPrice: dt(PRICE), needed: dt(need), oceanProtocolFee: dt(opcFee)};
  console.log(`\n  1 券に必要な額 ${dt(need)} OCEAN`);
  console.log(`    表示価格     ${dt(PRICE)}`);
  console.log(`    Ocean の手数料 ${dt(opcFee)}  ← 表示価格に上乗せされる`);

  await waitReceipt(conn, await sendTx(conn, {from: READER, to: SEPOLIA.Ocean,
    data: encodeCall(S.approve, ['address', 'uint256'], [datatoken, need])}));

  const before = {dt: await bal(conn, datatoken, READER), ocean: await bal(conn, SEPOLIA.Ocean, READER)};
  const freParams = [SEPOLIA.FixedPrice, exchangeId, need, 0n, '0x' + '00'.repeat(20)];
  const orderTx = await sendTx(conn, {from: READER, to: datatoken,
    data: encodeCall(S.buyFromFreAndOrder, [ORDER_PARAMS, FRE_PARAMS],
      [orderParams(READER, 0n), freParams])});
  const orc = await waitReceipt(conn, orderTx);
  const after = {dt: await bal(conn, datatoken, READER), ocean: await bal(conn, SEPOLIA.Ocean, READER)};
  const supply = BigInt(await ethCall(conn, datatoken, S.totalSupply));
  out.gas.buyFromFreAndOrder = gasUsed(orc);
  out.fixedRate.order = {
    dtBefore: dt(before.dt), dtAfter: dt(after.dt),
    oceanBefore: dt(before.ocean), oceanAfter: dt(after.ocean),
    oceanSpent: dt(before.ocean - after.ocean),
    totalSupplyAfter: dt(supply),
    orderStarted: orc.logs.filter((l) => l.topics[0] === TOPICS.OrderStarted).length,
    burned: orc.logs.filter((l) => l.topics[0] === TOPICS.Transfer
      && topicToAddress(l.topics[2]) === '0x0000000000000000000000000000000000000000').length,
  };
  console.log(`\n  注文しました (${n(gasUsed(orc))} ガス)`);
  console.log(`    券の残高     ${dt(before.dt)} → ${dt(after.dt)}`);
  console.log(`    OCEAN        ${dt(before.ocean)} → ${dt(after.ocean)}  (${dt(before.ocean - after.ocean)} 支払い)`);
  console.log(`    totalSupply  ${dt(supply)}`);
  console.log(`    OrderStarted ${out.fixedRate.order.orderStarted} 件 / 焼却 ${out.fixedRate.order.burned} 件`);

  // ── 5. template 1 で、券が本当に保有できるか ──────────────────
  rule(); head('template 1 — 券は在庫になるか');

  const dt1Tx = await sendTx(conn, {from: PUBLISHER, to: nft,
    data: encodeCall(S.createERC20, TYPES.createERC20,
      ercCreateData({templateIndex: 1, dtName: 'Kouigenji Access (t1)', dtSymbol: 'KGACC1',
        owner: PUBLISHER, feeCollector: SEPOLIA.OPFCommunityFeeCollector}))});
  const dt1r = await waitReceipt(conn, dt1Tx);
  const dt1 = topicToAddress(dt1r.logs.find((l) => l.topics[0] === TOPICS.TokenCreated).topics[1]);
  out.template1.datatoken = dt1;

  // template 1 の createDispenser は allowedSwapper をそのまま通す
  await waitReceipt(conn, await sendTx(conn, {from: PUBLISHER, to: dt1,
    data: encodeCall(S.createDispenser, ['address', 'uint256', 'uint256', 'bool', 'address'],
      [SEPOLIA.Dispenser, ONE, ONE, true, '0x' + '00'.repeat(20)])}));

  // 研究者が Dispenser を直接呼ぶ (template 2 ではここで revert した)
  const disp = await sendTx(conn, {from: READER, to: SEPOLIA.Dispenser,
    data: encodeCall(S.dispense, ['address', 'uint256', 'address'], [dt1, ONE, READER])});
  const dispR = await waitReceipt(conn, disp);
  const held = await bal(conn, dt1, READER);
  out.gas.dispenseT1 = gasUsed(dispR);
  out.template1.heldAfterDispense = dt(held);
  console.log(`  研究者が Dispenser.dispense を直接呼べた (${n(gasUsed(dispR))} ガス)`);
  console.log(`  → 呼んだ後の残高 ${dt(held)} 券   ${held > 0n ? c.ok('在庫になっている') : c.bad('0 のまま')}`);

  // 保有したまま、別のトランザクションで注文する
  const supplyBefore = BigInt(await ethCall(conn, dt1, S.totalSupply));
  const so = await sendTx(conn, {from: READER, to: dt1,
    data: encodeCall(S.startOrder, ['address', 'uint256', PROVIDER_FEE, CONSUME_FEE],
      [READER, 0n, NO_PROVIDER_FEE, NO_CONSUME_MARKET_FEE])});
  const soR = await waitReceipt(conn, so);
  const supplyAfter = BigInt(await ethCall(conn, dt1, S.totalSupply));
  out.gas.startOrderT1 = gasUsed(soR);
  out.template1.order = {
    readerAfter: dt(await bal(conn, dt1, READER)),
    publisherAfter: dt(await bal(conn, dt1, PUBLISHER)),
    opcAfter: dt(await bal(conn, dt1, SEPOLIA.OPFCommunityFeeCollector)),
    totalSupplyBefore: dt(supplyBefore), totalSupplyAfter: dt(supplyAfter),
    burned: supplyAfter < supplyBefore,
  };
  console.log(`\n  別の取引で startOrder (${n(gasUsed(soR))} ガス)`);
  console.log(`    研究者   ${out.template1.order.readerAfter} 券`);
  console.log(`    公開者   ${out.template1.order.publisherAfter} 券  ← 焼かずに渡している`);
  console.log(`    OPC      ${out.template1.order.opcAfter} 券`);
  console.log(`    totalSupply ${dt(supplyBefore)} → ${dt(supplyAfter)}  ${
    supplyAfter < supplyBefore ? '(焼かれた)' : c.ok('(減っていない = 焼かれていない)')}`);

  writeJson(path.join(OUT, 'ocean-paid.json'), out);
  console.log(`\n  → ${rel('ocean-paid.json')}`);
}

const TOPICS = {
  NFTCreated:   '0x' + keccak256('NFTCreated(address,address,string,address,string,string,bool,address)').toString('hex'),
  TokenCreated: '0x' + keccak256('TokenCreated(address,address,string,string,uint256,address)').toString('hex'),
  OrderStarted: '0x' + keccak256('OrderStarted(address,address,uint256,uint256,uint256,address,uint256)').toString('hex'),
  Transfer:     '0x' + keccak256('Transfer(address,address,uint256)').toString('hex'),
};

main().catch((e) => { console.error(e); process.exit(1); });
