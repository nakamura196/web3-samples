/**
 * **帖ごとに data NFT を発行する。** 既定では送りません。
 *
 *   op run --env-file=.env.local -- node scripts/16-publish-volumes.mjs              下見 (全 54 帖)
 *   op run --env-file=.env.local -- node scripts/16-publish-volumes.mjs --only 1     1 帖だけ
 *   op run --env-file=.env.local -- node scripts/16-publish-volumes.mjs --to 5 --send  1〜5 帖を送る
 *   op run --env-file=.env.local -- node scripts/16-publish-volumes.mjs --send       残り全部
 *
 * ── なぜ 54 個に分けるのか ──────────────────────────────────────
 * 「それらしいから」ではない。理由は 2 つある。
 *
 * 1. **写本は実際に帖ごとに散らばっている。** data NFT は資料そのものではなく
 *    **公開者の役**なので、54 個に分けると「桐壺の管理者」「帚木の管理者」を
 *    別々に持てる。1 個にまとめるとその構造を表現できない。
 *
 * 2. **帖ごとに利用回数が数えられる。** 1 個だと「何回参照されたか」しか出ない。
 *    54 個だと「どの帖が最も参照されるか」が出る。引用は帖単位でされるので、
 *    粒度が合う。GitHub のアクセス統計でも引用データベースでも出せない数字である。
 *
 * ── 各帖の DDO に包含証明を入れる ───────────────────────────────
 * ここがこの試作の Merkle ツリーと繋がるところ。
 *
 * 帖ツリー (葉 54 枚) の root は CorpusAnchor に刻んである。各帖の DDO に
 * **その帖の葉ハッシュと、root までの経路 (6 ハッシュ = 192 バイト)** を入れておくと、
 * 受け取った人は DDO だけで「この帖が、刻まれた全体の一部である」ことを確かめられる。
 * 他の 53 帖を 1 バイトも見ずに済む。
 *
 * ── 途中で止めても大丈夫にする ──────────────────────────────────
 * 54 回の送信は途中で失敗しうる。out/volumes.json に 1 帖ごとに追記し、
 * 既に出したものは飛ばす。同じコマンドを何度でも打ち直せる。
 */
import {SIG, TYPES, TOPIC, SEPOLIA, publishArgs, buildDdo, generateDid, ddoHash} from '../lib/ocean.mjs';
import {encodeCall, wordAt, topicToAddress} from '../lib/abi.mjs';
import {toChecksumAddress} from '../lib/keccak.mjs';
import * as merkle from '../lib/merkle.mjs';
import {hex} from '../lib/sha.mjs';
import {fileCid} from '../lib/cid.mjs';
import {readCorpus, flattenItems} from '../lib/tei.mjs';
import {requireRepo} from '../lib/source.mjs';
import {selectChain} from '../lib/chains.mjs';
import {connect, waitReceipt, gasUsed, sendSigned, balanceOf, baseFee,
  estimateGas, feePaid, formatEth} from '../lib/rpc.mjs';
import {addressOf, feesFrom} from '../lib/tx.mjs';
import {readCorpusOut, readJson, writeJson, OUT, rel} from '../lib/store.mjs';
import {c, rule, head, padTo, argOf} from '../lib/ui.mjs';
import fs from 'node:fs';
import path from 'node:path';

const send = process.argv.includes('--send');
const only = argOf('only') ? Number(argOf('only')) : null;
const from = only ?? (argOf('from') ? Number(argOf('from')) : 1);
const to = only ?? (argOf('to') ? Number(argOf('to')) : 54);
const n = (x) => Number(x).toLocaleString('en-US');

const priv = process.env.SEPOLIA_PRIVATE_KEY;
if (!priv || priv.startsWith('op://')) {
  console.error(c.ng('SEPOLIA_PRIVATE_KEY がありません (op run を通していますか)'));
  process.exit(1);
}
const ME = addressOf(priv);

const chain = selectChain('sepolia');
const conn = await connect(chain);
const corpusOut = readCorpusOut();
const sepolia = readJson(path.join(OUT, 'sepolia.json'), 'node scripts/07-sepolia.mjs --send');
const whole = readJson(path.join(OUT, 'publish.json'), 'node scripts/11-publish.mjs --send');

// ── 素材から 54 帖ぶんの材料を作る ──────────────────────────────
const corpus = readCorpus(requireRepo());
const items = flattenItems(corpus);
const linesPer = {};
for (const it of items) linesPer[it.chapter] = (linesPer[it.chapter] ?? 0) + 1;

const leaves = corpus.map((ch) => merkle.leafHash(ch.bytes));
const chapterRoot = '0x' + hex(merkle.root(leaves));
if (chapterRoot !== corpusOut.trees.chapter.root) {
  console.error(c.ng(`帖ツリーの root が 01-digest と違います: ${chapterRoot}`));
  process.exit(1);
}

const volumes = corpus.map((ch, i) => {
  const title = (ch.bytes.toString('utf8').match(/<title>([^<]*)<\/title>/)?.[1] ?? '')
    .replace(/^校異源氏物語[・:]?/, '').trim();
  return {
    index: i, number: i + 1, file: ch.name, title,
    bytes: ch.bytes.length,
    lines: linesPer[ch.name] ?? 0,
    leafHash: '0x' + hex(leaves[i]),
    proof: merkle.proof(i, leaves).map((h) => '0x' + hex(h)),
    cid: fileCid(ch.bytes).cid,
  };
});

rule(send ? '帖ごとに data NFT を発行する' : '帖ごとの発行 — 下見 (送りません)');
console.log(`  チェーン    ${chain.name} (chainId ${chain.chainId})`);
console.log(`  帖ツリーの root  ${chapterRoot}  ${c.ok('01-digest と一致')}`);
console.log(`  CorpusAnchor    ${sepolia.corpusAnchor}  ${c.dim('(この root は刻んである)')}`);
console.log(`  対象        ${from} 〜 ${to} 帖`);
if (!send) console.log(`  ${c.dim('--send を付けるまで、1 バイトも送りません。')}`);

// ── 包含証明が本当に通るか、送る前に全部確かめる ────────────────
head('包含証明の検算 — 送る前に 54 帖すべて');
let proofNg = 0;
for (const v of volumes) {
  const ok = merkle.verify(corpus[v.index].bytes, v.index, 54,
    v.proof.map((h) => Buffer.from(h.slice(2), 'hex')), Buffer.from(chapterRoot.slice(2), 'hex'));
  if (!ok) { proofNg++; console.log(`  ${c.ng('NG')} ${v.number} ${v.title}`); }
}
console.log(`  ${proofNg === 0 ? c.ok('54 帖すべて、経路 6 ハッシュで root に到達') : c.ng(proofNg + ' 件が通らない')}`);
if (proofNg) process.exit(1);
console.log(`  ${c.dim('各帖の DDO にこの経路を入れる → 他の 53 帖を見ずに検証できる')}`);

// ── 既に出したものを読む ────────────────────────────────────────
const outFile = path.join(OUT, 'volumes.json');
const done = fs.existsSync(outFile) ? readJson(outFile) : {generatedAt: null, chainId: chain.chainId, volumes: {}};
const todo = volumes.filter((v) => v.number >= from && v.number <= to && !done.volumes[v.number]);

head('発行するもの');
console.log(`  対象 ${to - from + 1} 帖 のうち、まだ出していないもの ${todo.length} 帖`);
if (Object.keys(done.volumes).length) {
  console.log(`  ${c.dim(`発行済み ${Object.keys(done.volumes).length} 帖 (飛ばします)`)}`);
}
for (const v of todo.slice(0, 3)) {
  console.log(`  ${String(v.number).padStart(2)} ${padTo(v.title, 14)} ${String(v.lines).padStart(5)} 行  ` +
    `${String(v.bytes).padStart(7)} B  経路 ${v.proof.length} ハッシュ`);
}
if (todo.length > 3) console.log(`  ${c.dim(`… ほか ${todo.length - 3} 帖`)}`);

const fees = feesFrom(await baseFee(conn));
const bal = await balanceOf(conn, ME);
const PER = 1362568n + 300000n;
head('費用');
console.log(`  残高        ${formatEth(bal)}`);
console.log(`  1 帖あたり   約 ${n(PER)} ガス = ${formatEth(PER * (fees.maxFeePerGas / 2n))}`);
console.log(`  ${todo.length} 帖       ${formatEth(PER * BigInt(todo.length) * (fees.maxFeePerGas / 2n))}`);

/** その帖の DDO を組む */
function ddoFor(v, nft, datatoken, iso) {
  return buildDdo({
    nftAddress: nft, chainId: chain.chainId, datatokenAddress: datatoken, created: iso,
    service: {id: `genji-${String(v.number).padStart(2, '0')}`, serviceEndpoint: `ipfs://${v.cid}`},
    metadata: {
      name: `校異源氏物語 ${v.title}（第${v.number}帖)`.replace('(', '（').replace(')', '）'),
      description: [
        `池田亀鑑『校異源氏物語』(1942) を底本とする源氏物語の校異データ。第${v.number}帖「${v.title}」。`,
        `TEI/XML ${n(v.lines)} 行 (<seg>) / ${n(v.bytes)} バイト。`,
        '',
        `この帖の本文: ipfs://${v.cid}`,
        `この帖の葉ハッシュ: ${v.leafHash}`,
        '',
        `全 54 帖の root: ${chapterRoot}`,
        `その root は CorpusAnchor (${sepolia.corpusAnchor}) に刻んであります。`,
        `この DDO に入っている ${v.proof.length} 個のハッシュで、この帖が全体の一部であることを`,
        '他の 53 帖を 1 バイトも見ずに確かめられます (RFC 6962)。',
      ].join('\n'),
      author: 'Satoru Nakamura / 中村 覚',
      license: 'CC0-1.0',
      tags: ['tei', 'genji', 'japanese-classics', 'digital-humanities', 'merkle', 'rfc6962',
        `volume-${String(v.number).padStart(2, '0')}`],
      additionalInformation: {
        volumeNumber: v.number, volumeTitle: v.title, file: v.file,
        lines: v.lines, bytes: v.bytes,
        ipfsCid: v.cid, ipfsUri: `ipfs://${v.cid}`,
        // ここが要点。DDO 単体で検証できるようにする
        merkleSpec: corpusOut.trees.chapter.spec,
        leafHash: v.leafHash, leafIndex: v.index, treeSize: 54,
        inclusionProof: v.proof,
        chapterRoot,
        corpusAnchor: sepolia.corpusAnchor,
        /**
         * **検証する人が、どのブロックから探せばよいか。**
         * これが無いと第三者は 780 万ブロックを舐めることになり、
         * 無料の公開 RPC (1 回 50,000 ブロックまで) では現実的に辿れない。
         * 第1帖を検証してみて初めて気づいた穴。
         */
        corpusAnchorFromBlock: sepolia.transactions[0].block,
        corpusId: corpusOut.corpusId,
        sourceCommit: corpusOut.source.commit,
        wholeCorpusNft: whole.nft,
      },
    },
  });
}

if (!send) {
  // 1 帖ぶんの DDO の大きさを見せる
  const sample = ddoFor(volumes[0], '0x' + '0'.repeat(40), '0x' + '0'.repeat(40), new Date().toISOString());
  const size = JSON.stringify(sample).length;
  head('DDO の見本 (第1帖)');
  console.log(`  大きさ      ${n(size)} バイト  ${c.dim('(全体版は 2,006 バイト)')}`);
  console.log(`  包含証明     ${volumes[0].proof.length} ハッシュ = ${volumes[0].proof.length * 32} バイト`);
  console.log(`  ${c.dim('この DDO だけで「第1帖が刻まれた root の一部である」を検証できます')}`);
  console.log('');
  console.log(c.warn('  下見なので、ここで終わります。何も送っていません。'));
  process.exit(0);
}

// ── 発行 ────────────────────────────────────────────────────────
head('発行します');
let spent = 0n;
for (const v of todo) {
  const label = `${String(v.number).padStart(2)} ${padTo(v.title, 12)}`;
  try {
    const args = publishArgs({
      name: `校異源氏物語 ${v.title}`,
      symbol: `KOUIGENJI${String(v.number).padStart(2, '0')}`,
      tokenURI: `https://kouigenjimonogatari.github.io/`,
      owner: ME, dtName: `${v.title} Access`,
      dtSymbol: `KG${String(v.number).padStart(2, '0')}`,
      dispenser: SEPOLIA.Dispenser, feeCollector: SEPOLIA.OPFCommunityFeeCollector,
    });
    const createData = encodeCall(SIG.createNftWithErc20WithDispenser,
      TYPES.createNftWithErc20WithDispenser, args);
    const gas = await estimateGas(conn, {from: ME, to: SEPOLIA.ERC721Factory, data: createData}) * 120n / 100n;
    const sent = await sendSigned(conn, {to: SEPOLIA.ERC721Factory, data: createData, gas, ...fees}, priv);
    const rc = await waitReceipt(conn, sent.hash, {tries: 150, intervalMs: 2000});
    if (rc.status !== '0x1') throw new Error('発行が失敗');

    const nftLog = rc.logs.find((l) => l.topics[0] === TOPIC.NFTCreated);
    const dtLog = rc.logs.find((l) => l.topics[0] === TOPIC.TokenCreated);
    const nft = toChecksumAddress('0x' + wordAt(nftLog.data, 0).slice(26));
    const datatoken = toChecksumAddress(topicToAddress(dtLog.topics[1]));

    const blk = await conn.call('eth_getBlockByNumber', ['latest', false]);
    const iso = new Date(Number(BigInt(blk.timestamp)) * 1000).toISOString();
    const ddo = ddoFor(v, nft, datatoken, iso);
    const json = JSON.stringify(ddo);
    const metaData = encodeCall(SIG.setMetaData, TYPES.setMetaData, [
      0n, `ipfs://${v.cid}`, ME, '0x00',
      '0x' + Buffer.from(json, 'utf8').toString('hex'), ddoHash(json), [],
    ]);
    const metaSent = await sendSigned(conn, {to: nft, data: metaData, gas: 500000n, ...fees}, priv);
    const metaRc = await waitReceipt(conn, metaSent.hash, {tries: 150, intervalMs: 2000});
    if (metaRc.status !== '0x1') throw new Error('DDO の書き込みが失敗');

    const fee = feePaid(rc) + feePaid(metaRc);
    spent += fee;
    done.volumes[v.number] = {
      number: v.number, title: v.title, file: v.file, lines: v.lines, bytes: v.bytes,
      nft, datatoken, did: generateDid(nft, chain.chainId),
      ipfsCid: v.cid, leafHash: v.leafHash, leafIndex: v.index,
      inclusionProof: v.proof, ddoBytes: json.length,
      createTx: sent.hash, metaTx: metaSent.hash,
      block: parseInt(rc.blockNumber, 16),
      gas: gasUsed(rc) + gasUsed(metaRc), feeWei: fee.toString(),
    };
    done.generatedAt = new Date().toISOString();
    done.chapterRoot = chapterRoot;
    done.corpusAnchor = sepolia.corpusAnchor;
    writeJson(outFile, done);   // 1 帖ごとに書く。途中で止まっても続きから再開できる
    console.log(`  ${label} ${c.ok('発行')} ${String(gasUsed(rc) + gasUsed(metaRc)).padStart(9)} ガス  ` +
      `DDO ${n(json.length)}B  ${c.dim(nft)}`);
  } catch (e) {
    console.log(`  ${label} ${c.ng('失敗')} ${String(e.message).slice(0, 70)}`);
    console.log(`  ${c.dim('ここまでの分は out/volumes.json に残っています。同じコマンドで続きから再開できます。')}`);
    break;
  }
}

head('結果');
console.log(`  発行済み    ${Object.keys(done.volumes).length} / 54 帖`);
console.log(`  払った手数料  ${formatEth(spent)}`);
console.log(`  残高        ${formatEth(await balanceOf(conn, ME))}`);
console.log(`  書き出し    ${rel(outFile)}`);
