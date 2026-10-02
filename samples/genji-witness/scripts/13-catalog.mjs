/**
 * カタログの中身を集める。**索引サーバを 1 度も呼ばない。**
 *
 *   node scripts/13-catalog.mjs
 *
 * ── 何のために作るのか ──────────────────────────────────────────
 * Etherscan は「チェーンに何があるか」を汎用的に見せる。だから
 * `DispenserCreated` (何も作られていない) や `1 of ○○` (個数ではなく背番号) の
 * ように、**名前と中身がずれたまま**表示される。読む側が約束事を知っている前提になる。
 *
 * ここで作るのは逆向きの道具で、「この資料について何が言えるか」だけを見せる。
 * 生のイベント名は出さない。代わりに「無料で配っています」「公開者の役はこの人です」
 * と書く。**つまずいた場所がそのまま仕様になっている。**
 *
 * ── 集め方 ──────────────────────────────────────────────────────
 * 1. チェーンから DDO を読む (flags 0x00 = 平文なので復号が要らない)
 * 2. チェーンから CorpusAnchored を読む (root と行き先)
 * 3. 公開ゲートウェイから本文が引けるか確かめ、CID を計算し直す
 * 4. 3 つが食い違っていないかを突き合わせる
 *
 * Ocean のノードも Aquarius も The Graph も使わない。
 * 使うのは JSON-RPC と HTTP GET だけ。
 */
import {TOPIC, decodeCorpusAnchored, wordAt, bytesAt, stringAt} from '../lib/abi.mjs';
/**
 * Ocean のイベントは lib/ocean.mjs の TOPIC にある。abi.mjs のほうには入っていない。
 * 取り違えると topics に undefined が入り、**絞り込み無しで全ログが返る**。
 * エラーにならず、黙って別のものを数えるので気づきにくい。
 */
import {TOPIC as OCEAN_TOPIC} from '../lib/ocean.mjs';
import {selectChain} from '../lib/chains.mjs';
import {connect, ethCall, getLogs} from '../lib/rpc.mjs';
import {selector} from '../lib/keccak.mjs';
import {fileCid} from '../lib/cid.mjs';
import {readCorpusOut, readJson, writeJson, OUT, ROOT, rel} from '../lib/store.mjs';
import {c, rule, head, padTo} from '../lib/ui.mjs';
import fs from 'node:fs';
import path from 'node:path';

const chain = selectChain('sepolia');
const conn = await connect(chain);
const corpus = readCorpusOut();
const sepolia = readJson(path.join(OUT, 'sepolia.json'), 'node scripts/07-sepolia.mjs --send');
const publish = readJson(path.join(OUT, 'publish.json'), 'node scripts/11-publish.mjs --send');
const ipfsOut = readJson(path.join(OUT, 'ipfs.json'), 'node scripts/08-ipfs.mjs --upload');
const order = (() => { try { return readJson(path.join(OUT, 'order.json')); } catch { return null; } })();

rule('カタログの材料を集める — 索引サーバを使わない');
console.log(`  ${c.dim('Ocean のノードも Aquarius も The Graph も呼びません。')}`);
console.log(`  ${c.dim('使うのは JSON-RPC と HTTP GET だけです。')}`);

const callStr = async (to, sig) => {
  const r = await ethCall(conn, to, selector(sig));
  return Buffer.from(r.slice(130), 'hex').toString('utf8').replace(/\0/g, '');
};
const callNum = async (to, sig, arg) =>
  BigInt(await ethCall(conn, to, selector(sig) + (arg ? arg.slice(2).padStart(64, '0') : '')));

// ── 1. data NFT ─────────────────────────────────────────────────
head('1. data NFT — チェーンに直接聞く');
const nft = publish.nft;
const nftInfo = {
  address: nft,
  name: await callStr(nft, 'name()'),
  symbol: await callStr(nft, 'symbol()'),
  totalSupply: Number(await callNum(nft, 'totalSupply()')),
  owner: '0x' + (await ethCall(conn, nft, selector('ownerOf(uint256)') + '1'.padStart(64, '0'))).slice(26),
  codeBytes: ((await conn.call('eth_getCode', [nft, 'latest'])).length - 2) / 2,
};
console.log(`  名前        ${nftInfo.name} (${nftInfo.symbol})`);
console.log(`  公開者の役   ${nftInfo.owner}`);
console.log(`  コード      ${nftInfo.codeBytes} バイト  ${c.dim('(最小プロキシ。本体は共有)')}`);

// ── 2. datatoken ────────────────────────────────────────────────
head('2. datatoken — 券の実際');
const dt = publish.datatoken;
const dtInfo = {
  address: dt,
  name: await callStr(dt, 'name()'),
  symbol: await callStr(dt, 'symbol()'),
  totalSupply: (await callNum(dt, 'totalSupply()')).toString(),
  cap: (await callNum(dt, 'cap()') / 10n ** 18n).toString(),
};
console.log(`  名前        ${dtInfo.name} (${dtInfo.symbol})`);
console.log(`  存在する券   ${dtInfo.totalSupply} 枚  ${c.dim('← 注文の瞬間に出て、同じ取引で焼かれる')}`);
console.log(`  上限        ${dtInfo.cap} 回分`);

// ── 3. DDO をチェーンから読む ───────────────────────────────────
head('3. メタデータ — 復号なしで読む');
const metaLogs = await getLogs(conn, {address: nft, topics: [OCEAN_TOPIC.MetadataCreated],
  fromBlock: '0x' + (publish.transactions[0].block ?? 11569100).toString(16)});
let ddo = null, ddoMeta = null;
if (metaLogs.length) {
  const l = metaLogs[metaLogs.length - 1];
  const flags = bytesAt(l.data, 2);
  const encrypted = (flags[0] & 2) !== 0;
  const payload = bytesAt(l.data, 3);
  ddoMeta = {flags: '0x' + flags.toString('hex'), encrypted, bytes: payload.length,
    hash: wordAt(l.data, 4), tx: l.transactionHash};
  console.log(`  flags       ${ddoMeta.flags}  ${encrypted ? c.ng('暗号化あり') : c.ok('暗号化なし → ノードが要らない')}`);
  console.log(`  大きさ       ${payload.length.toLocaleString('en-US')} バイト`);
  if (!encrypted) ddo = JSON.parse(payload.toString('utf8'));
} else {
  console.log(`  ${c.ng('MetadataCreated が見つかりません')}`);
}

// ── 4. CorpusAnchor ─────────────────────────────────────────────
head('4. root の記録 — 誰が、どこを指して刻んだか');
const deployBlock = Math.min(...sepolia.transactions.map((t) => t.block));
const anchorLogs = await getLogs(conn, {address: sepolia.corpusAnchor,
  topics: [TOPIC.CorpusAnchored], fromBlock: '0x' + deployBlock.toString(16)});
const anchors = anchorLogs.map(decodeCorpusAnchored);
console.log(`  記録        ${anchors.length} 件`);
const observers = [...new Set(anchors.map((a) => a.observer.toLowerCase()))];
console.log(`  刻んだ人     ${observers.length} 人  ` +
  (observers.length === 1 ? c.warn('← 公開者ひとり。独立した第三者はまだ 0 人') : ''));
for (const t of ['chapter', 'item']) {
  const tree = corpus.trees[t];
  const hits = anchors.filter((a) => a.root.toLowerCase() === tree.root.toLowerCase());
  console.log(`  ${padTo(t === 'chapter' ? '54 帖' : '25,065 行', 12)} ${hits.length} 件  ` +
    c.dim(hits.map((h) => h.sourceUri.replace(/^https:\/\/github\.com\/.*/, 'github')).join(' / ')));
}

// ── 4.5 利用の記録 ──────────────────────────────────────────────
head('4.5 利用の記録 — 誰が何回使ったか');
const orderLogs = await getLogs(conn, {address: dt, topics: [OCEAN_TOPIC.OrderStarted],
  fromBlock: '0x' + (publish.transactions[0].block ?? 11569100).toString(16)});
/**
 * OrderStarted(address indexed consumer, address indexed payer, uint256 amount,
 *              uint256 serviceIndex, uint256 timestamp, address indexed publishMarketAddress,
 *              uint256 blockNumber)
 * 「誰が使ったか」は topics に入っているので、復号も索引サーバも要らずに数えられる。
 */
// 実物で確かめた並び: topics[1] = 利用者 / topics[2] = 出品側の手数料の宛先
const orders = orderLogs.map((l) => ({
  consumer: '0x' + l.topics[1].slice(26),
  block: parseInt(l.blockNumber, 16), tx: l.transactionHash,
}));
const consumers = [...new Set(orders.map((o) => o.consumer.toLowerCase()))];
console.log(`  注文        ${orders.length} 件 / 利用者 ${consumers.length} 人`);
if (order?.selfControlled) {
  console.log(`  ${c.warn('うち自分で試した分が含まれます (研究者役の鍵も同じ人が持っている)')}`);
}
console.log(`  ${c.dim('券の残高は常に 0。数えているのは所有ではなく利用の回数')}`);

// ── 5. 本文が本当に引けるか ─────────────────────────────────────
head('5. 本文 — 外から引いて計算し直す');
const cid = ipfsOut.directory.cid;
const first = ipfsOut.files[0];
const gateways = ['https://ipfs.io', 'https://ipfs.filebase.io', 'https://gateway.pinata.cloud'];
const reach = [];
for (const g of gateways) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${g}/ipfs/${cid}/${first.name}`, {signal: AbortSignal.timeout(30000)});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const ok = fileCid(buf).cid === first.cid;
    reach.push({gateway: new URL(g).host, ok, bytes: buf.length, ms: Date.now() - t0});
    console.log(`  ${padTo(new URL(g).host, 18)} ${ok ? c.ok('取れて CID も一致') : c.ng('CID が違う')}  ${Date.now() - t0}ms`);
  } catch (e) {
    reach.push({gateway: new URL(g).host, ok: false, error: e.message});
    console.log(`  ${padTo(new URL(g).host, 18)} ${c.ng(e.message.slice(0, 40))}`);
  }
}

// ── 6. 突き合わせ ───────────────────────────────────────────────
head('6. 3 つが食い違っていないか');
const ai = ddo?.metadata?.additionalInformation ?? {};
const checks = [
  ['DDO の chapterRoot が 01-digest と同じ', ai.chapterRoot === corpus.trees.chapter.root],
  ['DDO の itemRoot が 01-digest と同じ', ai.itemRoot === corpus.trees.item.root],
  ['DDO の CID が 08-ipfs と同じ', ai.ipfsCid === cid],
  ['DDO が CorpusAnchor を指している', ai.corpusAnchor?.toLowerCase() === sepolia.corpusAnchor.toLowerCase()],
  ['チェーンの記録に同じ root がある',
    anchors.some((a) => a.root.toLowerCase() === corpus.trees.item.root.toLowerCase())],
  ['チェーンの記録が ipfs:// を指している', anchors.some((a) => a.sourceUri === `ipfs://${cid}`)],
  ['公開ゲートウェイから本文が引ける', reach.some((r) => r.ok)],
];
for (const [label, ok] of checks) console.log(`  ${ok ? c.ok('ok') : c.ng('NG')}  ${label}`);
const allOk = checks.every(([, ok]) => ok);

// ── 出力 ────────────────────────────────────────────────────────
const data = {
  generatedAt: new Date().toISOString(),
  builtWithout: ['Ocean Provider', 'Ocean Node / Aquarius', 'The Graph', 'Etherscan API'],
  chain: {name: chain.name, chainId: chain.chainId, explorer: chain.explorer, rpc: conn.url},
  corpus: {
    title: '校異源氏物語 (TEI/XML)',
    license: 'CC0-1.0',
    author: 'Satoru Nakamura / 中村 覚',
    chapters: corpus.chapters.length,
    lines: corpus.trees.item.treeSize,
    bytes: corpus.totals?.bytes ?? 5871913,
    sourceCommit: corpus.source.commit,
    sourceUri: corpus.source.sourceUri,
    corpusId: corpus.corpusId,
    trees: corpus.trees,
  },
  nft: nftInfo,
  datatoken: dtInfo,
  ddo: {...ddoMeta, document: ddo, did: publish.did},
  anchor: {
    contract: sepolia.corpusAnchor,
    verifiedSource: 'https://repo.sourcify.dev/11155111/' + sepolia.corpusAnchor,
    observers: observers.length,
    independentWitnesses: observers.filter((o) => o !== publish.publisher.toLowerCase()).length,
    records: anchors.map((a) => ({root: a.root, treeSize: a.treeSize, sourceUri: a.sourceUri,
      spec: a.spec, observer: a.observer, block: a.blockNumber, tx: a.txHash})),
  },
  usage: {
    orders: orders.length,
    consumers: consumers.length,
    selfControlled: order?.selfControlled ?? null,
    inOneTransaction: order?.inOneTransaction ?? null,
    records: orders,
    note: '券は誰の手元にも残らない。出す → 記録する → 焼く が 1 つの取引に閉じる',
  },
  ipfs: {cid, uri: `ipfs://${cid}`, files: ipfsOut.files.length,
    carBytes: ipfsOut.car?.bytes ?? null, gateways: reach},
  transactions: [...sepolia.transactions.map((t) => ({...t, group: 'anchor'})),
    ...publish.transactions.map((t) => ({...t, group: 'ocean'}))],
  checks: checks.map(([label, ok]) => ({label, ok})),
  allOk,
  caveats: [
    '独立した第三者はまだ 0 人。公開者ひとりが刻んだだけでは git tag -s を超えない',
    ...(order?.selfControlled ? ['利用の記録は自分で試した分。第三者の利用ではない'] : []),
    'IPFS に載っていることは「消えない」を意味しない。Filebase がやめれば取れなくなる',
    'Ocean Market には出てこない (索引サーバ api.nodes.oceanprotocol.com が 503)',
  ],
};
fs.mkdirSync(path.join(ROOT, 'catalog'), {recursive: true});
writeJson(path.join(ROOT, 'catalog', 'data.json'), data);
console.log('');
console.log(`  書き出し  ${rel(path.join(ROOT, 'catalog', 'data.json'))}`);
console.log(`  ${allOk ? c.ok('すべて整合しています。') : c.ng('食い違いがあります。')}`);
