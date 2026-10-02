/**
 * **本物の Sepolia に data NFT を発行する。** 既定では送りません。
 *
 *   op run --env-file=.env.local -- node scripts/11-publish.mjs          下見
 *   op run --env-file=.env.local -- node scripts/11-publish.mjs --send   実行
 *
 * ── 06-ocean.mjs との違い ───────────────────────────────────────
 * 06 は Sepolia を**フォークした** anvil に対して発行した。相手は本物の
 * バイトコードだったが、結果は手元に閉じていて、公開チェーンには何も残っていない。
 * ここでは同じことを本物のチェーンに対してやる。**取り消せない。**
 *
 * ── Ocean の「どこを使い、どこを使わないか」 ────────────────────
 * Ocean は 2 つの層でできている。混同されやすいので分けて書く。
 *
 *   チェーン上のコントラクト   ERC721Factory / ERC721Template /
 *                            ERC20Template / Dispenser
 *                            → **使う。** data NFT と datatoken を作る本体
 *
 *   チェーン外のサーバ         Provider (配信・暗号化) /
 *                            ocean-node・Aquarius (索引) / Market (画面)
 *                            → **使わない。** 無料かつ暗号化なしなら要らない
 *
 * つまり「Ocean を使わない」のではなく「Ocean の**サーバ側**を使わない」。
 * 自前で ERC-721 と ERC-20 を書くこともできるが、それだと Ocean の規格から
 * 外れて、他人の道具から読めなくなる。**共通の規格に乗ることが Ocean の値打ち**で、
 * サーバはその値打ちの本体ではない。
 *
 * ── 06 から変える点 ─────────────────────────────────────────────
 * - 鍵を手元で持つ (anvil の開錠済みアカウントが無い)
 * - EIP-7702 の委任消し (anvil_setCode) はやらない。**やれないし、要らない**。
 *   この鍵は自分で作った素の EOA で、委任が刺さっていないことを確かめてから進む
 * - serviceEndpoint を **ipfs:// にする**。08 で本文を載せたので指せるようになった
 * - 移転の実験はしない (鍵が 1 本しか無い)
 */
import {SIG, TYPES, TOPIC, SEPOLIA, publishArgs, buildDdo, generateDid, ddoHash} from '../lib/ocean.mjs';
import {encodeCall, wordAt, stringAt, bytesAt, topicToAddress, asBool} from '../lib/abi.mjs';
import {toChecksumAddress} from '../lib/keccak.mjs';
import {selectChain} from '../lib/chains.mjs';
import {connect, waitReceipt, gasUsed, sendSigned, nonceOf, balanceOf,
  baseFee, estimateGas, feePaid, formatEth, ethCall} from '../lib/rpc.mjs';
import {addressOf, feesFrom} from '../lib/tx.mjs';
import {readCorpusOut, readJson, writeJson, OUT, rel} from '../lib/store.mjs';
import {c, rule, head, padTo} from '../lib/ui.mjs';
import path from 'node:path';

const send = process.argv.includes('--send');
const n = (x) => Number(x).toLocaleString('en-US');

const priv = process.env.SEPOLIA_PRIVATE_KEY;
if (!priv || priv.startsWith('op://')) {
  console.error(c.ng('SEPOLIA_PRIVATE_KEY がありません (op run を通していますか)'));
  process.exit(1);
}
const ME = addressOf(priv);

const chain = selectChain('sepolia');
const conn = await connect(chain);
const corpus = readCorpusOut();
const ipfs = readJson(path.join(OUT, 'ipfs.json'), 'node scripts/08-ipfs.mjs --upload');
const IPFS_URI = `ipfs://${ipfs.directory.cid}`;

rule(send ? '本物の Sepolia に data NFT を発行する' : '本物の Sepolia — 下見 (送りません)');
console.log(`  チェーン   ${chain.name} (chainId ${chain.chainId})`);
console.log(`  RPC        ${conn.url}`);
console.log(`  Factory    ${SEPOLIA.ERC721Factory}  ${c.dim('(Ocean が Sepolia に置いた本物)')}`);
console.log(`  ${c.warn('公開チェーンです。発行したものは取り消せません。')}`);
if (!send) console.log(`  ${c.dim('--send を付けるまで、1 バイトも送りません。')}`);

// ── 送る人。EIP-7702 の委任が無いことを確かめる ─────────────────
head('送る人');
const code = await conn.call('eth_getCode', [ME, 'latest']);
const bal = await balanceOf(conn, ME);
console.log(`  アドレス   ${ME}`);
console.log(`  残高       ${formatEth(bal)}`);
console.log(`  nonce      ${await nonceOf(conn, ME)}`);
/**
 * 06 では anvil の既定アカウント 10 個すべてに 0xef0100… の委任が刺さっていて、
 * _safeMint が onERC721Received を呼びに行って revert した。
 * 自分で作った鍵なら刺さらない。念のため毎回見る。
 */
if (code !== '0x') {
  console.error(c.ng(`  このアドレスにはコードがあります (${(code.length - 2) / 2} バイト)`));
  console.error(c.ng('  EIP-7702 の委任が刺さっていると _safeMint が revert します。'));
  process.exit(1);
}
console.log(`  コード     ${c.ok('なし — 素の EOA。EIP-7702 の委任も無い')}`);

// ── 1. data NFT + datatoken + Dispenser ─────────────────────────
const args = publishArgs({
  name: '校異源氏物語 TEI', symbol: 'KOUIGENJI',
  tokenURI: 'https://kouigenjimonogatari.github.io/',
  owner: ME, dtName: 'Kouigenji Access', dtSymbol: 'KGACCESS',
  dispenser: SEPOLIA.Dispenser, feeCollector: SEPOLIA.OPFCommunityFeeCollector,
});
const createData = encodeCall(SIG.createNftWithErc20WithDispenser,
  TYPES.createNftWithErc20WithDispenser, args);

head('1. 発行するもの');
console.log(`  data NFT   "校異源氏物語 TEI" (KOUIGENJI)  ${c.dim('移転できる')}`);
console.log(`  datatoken  "Kouigenji Access" (KGACCESS)   ${c.dim('template 2 = Ocean Market の既定')}`);
console.log(`  Dispenser  ${c.dim('無料で 1 個ずつ。在庫を持たない (withMint)')}`);
console.log(`  calldata   ${n((createData.length - 2) / 2)} バイト`);

const fees = feesFrom(await baseFee(conn));
let createGas;
try {
  createGas = await estimateGas(conn, {from: ME, to: SEPOLIA.ERC721Factory, data: createData}) * 125n / 100n;
} catch (e) {
  console.error(c.ng(`  ガスを見積もれません: ${e.message.slice(0, 80)}`));
  process.exit(1);
}
console.log(`  ガス見積り  ${n(createGas)}  ${c.dim('(見積り + 25%)')}`);

// ── 2. DDO ──────────────────────────────────────────────────────
head('2. メタデータ (DDO)');
console.log(`  serviceEndpoint  ${IPFS_URI}`);
console.log(`  ${c.dim('↑ 06 では GitHub を指していた。08 で本文を IPFS に載せたので、こちらを指せる')}`);
console.log(`  ${c.dim('flags 0x00 = 暗号化しない → Ocean のノードが要らない')}`);

if (!send) {
  const total = createGas + 260000n;   // DDO 書き込みの実測 220,820 に余裕
  console.log('');
  head('費用');
  console.log(`  ガス上限の合計  ${n(total)}`);
  console.log(`  だいたい        ${formatEth(total * (await baseFee(conn) + fees.maxPriorityFeePerGas))}`);
  console.log(`  残高で足りるか   ${bal > total * fees.maxFeePerGas ? c.ok('足ります') : c.ng('足りません')}`);
  console.log('');
  console.log(c.warn('  下見なので、ここで終わります。何も送っていません。'));
  process.exit(0);
}

// ── 送る ────────────────────────────────────────────────────────
head('送ります');
const createSent = await sendSigned(conn, {to: SEPOLIA.ERC721Factory, data: createData, gas: createGas, ...fees}, priv);
const createRc = await waitReceipt(conn, createSent.hash, {tries: 120, intervalMs: 2000});
if (createRc.status !== '0x1') {
  console.error(c.ng(`  失敗しました ${chain.explorer}/tx/${createSent.hash}`));
  process.exit(1);
}
const logOf = (topic, addr) => createRc.logs.find(
  (l) => l.topics[0] === topic && (!addr || l.address.toLowerCase() === addr.toLowerCase()));
const nftLog = logOf(TOPIC.NFTCreated);
const dtLog = logOf(TOPIC.TokenCreated, null);
const dispLog = logOf(TOPIC.DispenserCreated);
if (!nftLog || !dtLog || !dispLog) {
  console.error(c.ng('  期待したイベントが出ていません。'));
  console.error(`  出たイベント: ${createRc.logs.map((l) => l.topics[0].slice(0, 10)).join(' ')}`);
  process.exit(1);
}
const nft = toChecksumAddress('0x' + wordAt(nftLog.data, 0).slice(26));
const datatoken = toChecksumAddress(topicToAddress(dtLog.topics[1]));
console.log(`  data NFT   ${nft}  ${c.dim(`"${stringAt(nftLog.data, 1)}" / 移転できる: ${asBool(wordAt(nftLog.data, 4)) ? 'はい' : 'いいえ'}`)}`);
console.log(`  datatoken  ${datatoken}`);
console.log(`  Dispenser  ${c.dim(`maxTokens ${BigInt(wordAt(dispLog.data, 0)) / 10n ** 18n} / 無料`)}`);
console.log(`  ${n(gasUsed(createRc))} ガス  ${c.dim(chain.explorer + '/tx/' + createSent.hash)}`);

const did = generateDid(nft, chain.chainId);
head('DID');
console.log(`  ${c.b(did)}`);
console.log(`  ${c.dim(`sha256("${nft}" + "${chain.chainId}")`)}`);

// ── DDO をチェーンに書く ────────────────────────────────────────
head('メタデータをチェーンに書く');
const blk = await conn.call('eth_getBlockByNumber', ['latest', false]);
const iso = new Date(Number(BigInt(blk.timestamp)) * 1000).toISOString();
const chapterTree = corpus.trees.chapter;
const itemTree = corpus.trees.item;
const sepolia = (() => { try { return readJson(path.join(OUT, 'sepolia.json')); } catch { return null; } })();

const ddo = buildDdo({
  nftAddress: nft, chainId: chain.chainId, datatokenAddress: datatoken, created: iso,
  service: {serviceEndpoint: IPFS_URI},
  metadata: {
    name: '校異源氏物語 (TEI/XML)',
    description: [
      '池田亀鑑『校異源氏物語』(1942) を底本とする源氏物語の校異データ。',
      `TEI/XML ${corpus.chapters.length} 帖、${n(itemTree.treeSize)} 行 (<seg>)。`,
      '',
      `帖ツリーの root: ${chapterTree.root}`,
      `行ツリーの root: ${itemTree.root}`,
      `どちらも RFC 6962 (${chapterTree.spec})。`,
      `素材の commit: ${corpus.source.commit}`,
      '',
      `本文は IPFS にあります: ${IPFS_URI}`,
      sepolia ? `root は CorpusAnchor (${sepolia.corpusAnchor}) に刻んであります。` : '',
      '1 行だけの包含証明を 645 バイトで作れます。',
    ].filter(Boolean).join('\n'),
    author: 'Satoru Nakamura / 中村 覚',
    license: 'CC0-1.0',
    tags: ['tei', 'genji', 'japanese-classics', 'digital-humanities', 'merkle', 'rfc6962', 'ipfs'],
    additionalInformation: {
      sourceUri: corpus.source.sourceUri,
      sourceCommit: corpus.source.commit,
      ipfsCid: ipfs.directory.cid,
      ipfsUri: IPFS_URI,
      merkleSpec: chapterTree.spec,
      chapterRoot: chapterTree.root, chapterTreeSize: chapterTree.treeSize,
      itemRoot: itemTree.root, itemTreeSize: itemTree.treeSize,
      corpusAnchor: sepolia?.corpusAnchor ?? null,
      corpusId: corpus.corpusId,
    },
  },
});
const json = JSON.stringify(ddo);
const hash = ddoHash(json);
const metaData = encodeCall(SIG.setMetaData, TYPES.setMetaData, [
  0n, IPFS_URI, ME, '0x00', '0x' + Buffer.from(json, 'utf8').toString('hex'), hash, [],
]);
const metaSent = await sendSigned(conn, {to: nft, data: metaData, gas: 400000n, ...fees}, priv);
const metaRc = await waitReceipt(conn, metaSent.hash, {tries: 120, intervalMs: 2000});
if (metaRc.status !== '0x1') {
  console.error(c.ng(`  失敗 ${chain.explorer}/tx/${metaSent.hash}`));
  process.exit(1);
}
const metaLog = metaRc.logs.find((l) => l.topics[0] === TOPIC.MetadataCreated);
const onchainFlags = bytesAt(metaLog.data, 2);
const onchainData = bytesAt(metaLog.data, 3);
const onchainHash = wordAt(metaLog.data, 4);
console.log(`  DDO ${n(json.length)} バイトをそのままチェーンに置いた (${n(gasUsed(metaRc))} ガス)`);
console.log(`  flags 0x${onchainFlags.toString('hex')} → ${c.dim('暗号化しない。読む側にノードが要らない')}`);
console.log(`  ${c.dim(chain.explorer + '/tx/' + metaSent.hash)}`);

const roundTrip = JSON.stringify(JSON.parse(onchainData.toString('utf8')));
const parsed = JSON.parse(roundTrip);
const checks = [
  ['チェーンから読んだ data が同じ JSON になる', roundTrip === json],
  ['hash が indexer の計算と一致する', onchainHash.toLowerCase() === hash.toLowerCase()],
  ['DDO の中の root が 01-digest と同じ', parsed.metadata.additionalInformation.itemRoot === itemTree.root],
  ['serviceEndpoint が IPFS を指している', parsed.services[0].serviceEndpoint === IPFS_URI],
];
for (const [label, ok] of checks) console.log(`  ${ok ? c.ok('ok') : c.ng('NG')}  ${label}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);

const spent = feePaid(createRc) + feePaid(metaRc);
head('結果');
console.log(`  data NFT   ${chain.explorer}/address/${nft}`);
console.log(`  払った手数料 ${formatEth(spent)}`);
console.log(`  残高        ${formatEth(await balanceOf(conn, ME))}`);
console.log(`  ${c.warn('Ocean Market には出てきません (索引サーバが 503 のため)')}`);
console.log(`  ${c.dim('自分のカタログ (10-catalog.mjs) からは読めます')}`);

writeJson(path.join(OUT, 'publish.json'), {
  generatedAt: new Date().toISOString(),
  chain: {key: chain.key, chainId: chain.chainId, explorer: chain.explorer},
  note: '**本物の Sepolia**。06-ocean.mjs はフォークの中だけだった',
  publisher: ME, nft, datatoken, did,
  ddo: {bytes: json.length, hash, flags: '0x00', encrypted: false, serviceEndpoint: IPFS_URI},
  transactions: [
    {label: 'data NFT + datatoken + Dispenser', txHash: createSent.hash, gas: gasUsed(createRc)},
    {label: 'DDO をチェーンに書く', txHash: metaSent.hash, gas: gasUsed(metaRc)},
  ],
  feeWeiTotal: spent.toString(),
  oceanServersUsed: [],
  caveat: 'Ocean のコントラクトは使ったが、Ocean のサーバは 1 台も使っていない',
});
console.log(`  書き出し    ${rel(path.join(OUT, 'publish.json'))}`);
