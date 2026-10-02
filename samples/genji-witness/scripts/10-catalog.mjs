/**
 * チェーンだけを見て Ocean のカタログを組み立てる。**索引サーバを使わない。**
 *
 *   node scripts/10-catalog.mjs              自分の資産だけ (速い)
 *   node scripts/10-catalog.mjs --all        Sepolia の全 data NFT を舐める (数分)
 *   node scripts/10-catalog.mjs --all --from 11000000   途中から
 *
 * ── なぜ書くのか ────────────────────────────────────────────────
 * Ocean Market は 0 件を表示する。資産が無いからではなく、
 * **索引サーバ (api.nodes.oceanprotocol.com) が 503 を返している**からである。
 * 2026-08-26 時点で Sepolia には data NFT が 3,986 個あった。
 *
 * 索引サーバは「速く検索するための道具」であって「データの在り処」ではない。
 * チェーンから直接読めば、サーバが 1 台も無くてもカタログは作れる。
 *
 * ── 2 段構えになる理由 ──────────────────────────────────────────
 * メタデータのイベント (MetadataCreated) を出すのは、Factory ではなく
 * **NFT ごとの契約**である。だから「トピックだけで全部拾う」ができない。
 * しかも無料の公開 RPC は **アドレス指定を必須にしている** (実測):
 *
 *   publicnode  1 回 50,000 ブロックまで / アドレス必須 / 150 回ほどで締め出し
 *   1rpc.io     1 回 50 ブロックまで (索引には使えない)
 *
 * そこで:
 *   1. Factory (アドレスが分かっている) の NFTCreated を舐めて NFT の一覧を作る
 *   2. その一覧をアドレスとして渡し、MetadataCreated を引く
 *
 * ── 読めるものと読めないもの ────────────────────────────────────
 * flags の bit 1 が立っていると DDO は**暗号化されている**。復号できるのは
 * decryptorUrl が指すノードだけで、こちらでは中身を読めない。
 * 存在は見えるが中身は見えない、という形でカタログに出す。
 * この試作の資産は flags 0x00 なので平文で読める。
 */
import {TOPIC, wordAt} from '../lib/abi.mjs';
import {SEPOLIA as OCEAN_SEPOLIA} from '../lib/ocean.mjs';
import {selectChain} from '../lib/chains.mjs';
import {connect} from '../lib/rpc.mjs';
import {writeJson, OUT, rel} from '../lib/store.mjs';
import {c, rule, head, padTo, argOf} from '../lib/ui.mjs';
import path from 'node:path';

const all = process.argv.includes('--all');
const WINDOW = 50000;           // publicnode の上限 (実測)
const PARALLEL = 4;             // 締め出しを避けるため控えめに
const START = Number(argOf('from', 3722802));   // Ocean が Sepolia に置かれたブロック

const chain = selectChain('sepolia');
const conn = await connect(chain);
const head_ = Number(BigInt(await conn.call('eth_blockNumber', [])));

rule('チェーンだけでカタログを作る — 索引サーバを使わない');
console.log(`  チェーン   ${chain.name}`);
console.log(`  RPC        ${conn.url}`);
console.log(`  Factory    ${OCEAN_SEPOLIA.ERC721Factory}`);
console.log(`  範囲       ${START.toLocaleString('en-US')} 〜 ${head_.toLocaleString('en-US')}`);
console.log(`  ${c.dim('読むだけです。1 バイトも送りません。')}`);

const windows = [];
for (let b = START; b <= head_; b += WINDOW) windows.push([b, Math.min(b + WINDOW - 1, head_)]);

/** 上限つきの並列実行。無限ループにしない */
async function pool(items, worker, n = PARALLEL) {
  const queue = [...items];
  const runners = Array.from({length: n}, async () => {
    while (queue.length) await worker(queue.shift());
  });
  await Promise.all(runners);
}

const logs = (params) => conn.call('eth_getLogs', [params]);
const hex = (n) => '0x' + n.toString(16);

// ── 1. Factory から data NFT の一覧 ─────────────────────────────
head(`1. Factory から data NFT を集める (窓 ${windows.length} 個)`);
const nfts = new Map();
let failed = 0, done = 0;
await pool(windows, async ([f, t]) => {
  try {
    const got = await logs({fromBlock: hex(f), toBlock: hex(t),
      address: OCEAN_SEPOLIA.ERC721Factory, topics: [TOPIC.NFTCreated]});
    // NFTCreated(address newTokenAddress, address indexed templateAddress,
    //            string tokenName, address indexed admin, ...)
    // 新しい NFT のアドレスは **data の先頭ワード**。topics[1] はテンプレート
    for (const l of got) {
      nfts.set('0x' + l.data.slice(26, 66), {block: parseInt(l.blockNumber, 16), tx: l.transactionHash});
    }
  } catch (e) {
    failed++;
  }
  done++;
  if (done % 25 === 0) process.stdout.write(`\r  ${done}/${windows.length} 窓  ${nfts.size} 個`);
});
console.log(`\r  ${done}/${windows.length} 窓  data NFT ${nfts.size} 個` +
  (failed ? `  ${c.warn(`${failed} 窓が失敗 (レート制限)`)}` : ''));

if (!all) {
  console.log(`  ${c.dim('--all を付けるとメタデータまで読みます (数分)')}`);
}

// ── 2. メタデータを引く ─────────────────────────────────────────
const assets = [];
if (all) {
  head('2. メタデータ (MetadataCreated) を引く');
  /**
   * 素朴に「全 NFT × 全ブロック」を舐めると 1 万回を超えて締め出される。
   * メタデータは **NFT が作られた直後に同じ流れで設定される**ことがほとんどなので、
   * 作られた窓ごとにまとめ、その窓 + 1 窓ぶんだけを見る。
   * 後から更新された分は取りこぼすが、それは log() で明示する (黙って切らない)。
   */
  const byWindow = new Map();
  for (const [addr, v] of nfts) {
    const w = Math.floor((v.block - START) / WINDOW);
    if (!byWindow.has(w)) byWindow.set(w, []);
    byWindow.get(w).push(addr);
  }
  const BATCH = 100;     // アドレス配列。500 は拒否された (実測)
  const jobs = [];
  for (const [w, addrs] of byWindow) {
    for (let i = 0; i < addrs.length; i += BATCH) {
      jobs.push({from: START + w * WINDOW, to: Math.min(START + (w + 2) * WINDOW - 1, head_),
        addrs: addrs.slice(i, i + BATCH)});
    }
  }
  console.log(`  ${nfts.size} 個を、作られた窓ごとに ${jobs.length} 回の問い合わせで引きます`);
  console.log(`  ${c.dim('作成から 2 窓 (10 万ブロック) 以内に設定された分だけ見ます。後の更新は取りこぼします')}`);
  let b = 0, jobFail = 0;
  await pool(jobs, async (job) => {
    try {
      const got = await logs({fromBlock: hex(job.from), toBlock: hex(job.to),
        address: job.addrs, topics: [TOPIC.MetadataCreated]});
      for (const l of got) assets.push(decodeMetadata(l));
    } catch { jobFail++; }
    b++;
    if (b % 10 === 0) process.stdout.write(`\r  ${b}/${jobs.length}  ${assets.length} 件`);
  }, 3);
  console.log(`\r  ${b}/${jobs.length}  MetadataCreated ${assets.length} 件` +
    (jobFail ? `  ${c.warn(`${jobFail} 回が失敗 (レート制限)`)}` : ''));
}

/**
 * MetadataCreated(address indexed createdBy, uint8 state, string decryptorUrl,
 *                 bytes flags, bytes data, bytes32 metaDataHash, uint256 ts, uint256 block)
 * indexed は createdBy だけ。残りは data に宣言順で並ぶ。
 */
function decodeMetadata(log) {
  const d = log.data.slice(2);
  const W = (i) => d.slice(i * 64, (i + 1) * 64);
  const at = (off) => off / 32;
  const str = (off) => {
    const i = at(off), len = parseInt(W(i), 16);
    return Buffer.from(d.slice((i + 1) * 64, (i + 1) * 64 + len * 2), 'hex').toString('utf8');
  };
  const byt = (off) => {
    const i = at(off), len = parseInt(W(i), 16);
    return len === 0 ? '0x' : '0x' + d.slice((i + 1) * 64, (i + 1) * 64 + len * 2);
  };
  const flags = byt(parseInt(W(2), 16));
  const encrypted = (parseInt(flags.slice(2, 4) || '0', 16) & 2) !== 0;
  const payloadOff = at(parseInt(W(3), 16));
  const payloadLen = parseInt(W(payloadOff), 16);
  const payloadHex = d.slice((payloadOff + 1) * 64, (payloadOff + 1) * 64 + payloadLen * 2);

  let document = null;
  if (!encrypted) {
    try { document = JSON.parse(Buffer.from(payloadHex, 'hex').toString('utf8')); } catch { /* 平文でない */ }
  }
  return {
    nft: log.address,
    createdBy: '0x' + log.topics[1].slice(26),
    block: parseInt(log.blockNumber, 16),
    tx: log.transactionHash,
    state: parseInt(W(0), 16),
    decryptorUrl: str(parseInt(W(1), 16)),
    flags, encrypted,
    metaDataHash: '0x' + W(4),
    bytes: payloadLen,
    document,
  };
}

// ── 3. まとめ ───────────────────────────────────────────────────
if (all) {
  const plain = assets.filter((a) => !a.encrypted);
  const readable = plain.filter((a) => a.document);
  head('3. 読めたもの / 読めなかったもの');
  console.log(`  MetadataCreated   ${assets.length} 件`);
  console.log(`  暗号化なし         ${plain.length} 件  ${c.dim('(flags の bit 1 が立っていない)')}`);
  console.log(`  JSON として読めた   ${readable.length} 件`);
  console.log(`  暗号化あり         ${assets.length - plain.length} 件  ` +
    c.warn('← ノードに頼まないと中身が読めない'));
  const nodes = [...new Set(assets.filter((a) => a.encrypted && a.decryptorUrl).map((a) => a.decryptorUrl))];
  console.log(`  依存しているノード   ${nodes.length} 種類`);
  for (const n of nodes.slice(0, 5)) console.log(`    ${c.dim(n)}`);

  if (readable.length) {
    head('読めた資産');
    for (const a of readable.slice(0, 20)) {
      const m = a.document.metadata ?? {};
      console.log(`  ${padTo(String(m.name ?? '(名前なし)').slice(0, 34), 36)} ` +
        `${padTo(m.license ?? '-', 12)} ${c.dim(a.nft)}`);
    }
    if (readable.length > 20) console.log(`  ${c.dim(`… ほか ${readable.length - 20} 件`)}`);
  }
}

const out = {
  generatedAt: new Date().toISOString(),
  chain: {key: chain.key, chainId: chain.chainId, rpc: conn.url},
  scanned: {fromBlock: START, toBlock: head_, windows: windows.length, failedWindows: failed},
  note: '索引サーバ (Aquarius / ocean-node) を 1 度も呼んでいない。チェーンだけで作った',
  dataNftCount: nfts.size,
  metadataCount: assets.length,
  assets: all ? assets : null,
  nfts: all ? null : [...nfts.entries()].map(([addr, v]) => ({address: addr, ...v})),
};
writeJson(path.join(OUT, 'catalog.json'), out);
console.log('');
console.log(`  書き出し  ${rel(path.join(OUT, 'catalog.json'))}`);
