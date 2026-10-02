/**
 * 何がチェーンでなければならなかったのか。**この事例では、ほとんど無い。**
 *
 *   node scripts/05-compare.mjs
 *
 * ── ndl-witness と何が違うのか ──────────────────────────────────
 * ndl-witness では、中村は NDL の公開物を外から観測する第三者だった。
 * 記録を作る人と、記録される対象が別人だったので、証人として意味があった。
 *
 * 校異源氏物語では、中村は公開している側である。**記録を作る人と、
 * 記録される対象が同じ**になる。これは did-prototype (案A) が行き止まりに
 * なったのと同じ形で、自分で自分の版を刻むだけならチェーンは要らない。
 *
 * では何が残るのか。2 つある。
 *
 *   (1) 1 行だけを、リポジトリを持たない相手に証明できる
 *       … これは Merkle ツリーの働きで、**チェーンとは無関係**に成り立つ
 *   (2) その root を第三者が独立に刻める / 誰も消せない
 *       … これだけがチェーンでしか作れない
 *
 * この 2 つを混ぜないことが、この試作の主眼である。
 */
import {selectChain} from '../lib/chains.mjs';
import {connect, getLogs} from '../lib/rpc.mjs';
import {TOPIC, decodeCorpusAnchored} from '../lib/abi.mjs';
import {readCorpusOut, readAnchored, readDeployed, readJson, OUT} from '../lib/store.mjs';
import {c, rule, padTo} from '../lib/ui.mjs';
import path from 'node:path';

const corpus = readCorpusOut();
const anchored = readAnchored();
const deployed = readDeployed();
const perm = readJson(path.join(OUT, 'permanence.json'), 'node scripts/04-permanence.mjs');

rule('何がチェーンでなければならなかったのか');

console.log(`  資料       ${corpus.corpusUri}`);
console.log(`  規模       ${corpus.trees.chapter.treeSize} 帖 / ` +
  `${corpus.trees.item.treeSize.toLocaleString('en-US')} 行 / ` +
  `${(corpus.totals.chapterBytes / 1024 / 1024).toFixed(1)} MB`);
console.log(`  立場       ${c.warn('中村は公開している側 (ndl-witness では観測する第三者だった)')}`);

// ── 表1: 1 行の版を証明する手段 ─────────────────────────────────
rule('表1 — 「この 1 行はこの版でこうだった」を示す手段');

const W1 = [34, 12, 14, 12, 12];
const O = 'できる', X = 'できない', T = '条件つき';
const tint = (v) => (v === O ? c.ok : v === X ? c.ng : v === T ? c.warn : (s) => s);
const row1 = (cells, style) =>
  console.log('  ' + cells.map((x, i) =>
    (style ? style(padTo(x, W1[i])) : i === 0 ? padTo(x, W1[i]) : tint(x)(padTo(x, W1[i])))).join(''));

row1(['', '署名付き', 'RFC 3161', 'IPFS', 'このアンカー'], c.b);
row1(['', 'git タグ', 'タイムスタンプ', 'CID', '(Merkle+鎖)'], c.dim);
console.log('  ' + '─'.repeat(W1.reduce((a, b) => a + b, 0)));

const rows1 = [
  ['帖 1 本の内容を固定する', O, O, O, O],
  ['その時刻に存在したと示す', X, O, X, O],
  ['1 行だけを取り出して証明する', X, X, X, O],
  ['相手がリポジトリ無しで検証できる', X, T, T, O],
  ['渡す量が数百バイトで済む', X, X, X, O],
  ['公開者が過去を作り直せない', X, T, X, O],
  ['第三者が独立に記録を足せる', X, T, X, O],
  ['記録を消せなくする', X, X, X, O],
];
for (const r of rows1) row1(r);

const item = corpus.trees.item;
console.log(c.dim(`
  3 行目「1 行だけを取り出して証明する」が、この資料でいちばん効く。
  git の粒度はファイル単位で、blob は帖 1 本まるごと (最大 309,169 バイト) である。
  論文で 1 行だけ引用した人に「その行が確かにこの版のものだ」と示すには、
  帖 1 本か、リポジトリ全体を渡すことになる。

  Merkle ツリーだと渡すものは ${item.proofLength} ハッシュ (${item.proofLength * 32} バイト) + その行だけになる。
  実測 645 バイト (0005-01) — 本文 ${(corpus.totals.chapterBytes).toLocaleString('en-US')} バイトの 9,104 分の 1。`));

// ── 表2: チェーンを外すと何が壊れるか ───────────────────────────
rule('表2 — チェーンを外したら、何が壊れるか');

console.log(`  ${c.b('壊れない (Merkle ツリーだけで足りる)')}`);
for (const s of [
  '1 行だけの証明を作る',
  '渡す量を 645 バイトに縮める',
  '受け取った側がサーバ無しで検証する',
  '版が違えばどの行が違うかを突き止める',
]) console.log(`    ${c.ok('○')} ${s}`);

console.log('');
console.log(`  ${c.b('壊れる (チェーンでしか作れない)')}`);
for (const s of [
  'root を後から消せない',
  '第三者が同じ root を独立に足せる',
  '「何人が独立に同じものを見たか」が数えられる',
]) console.log(`    ${c.ng('×')} ${s}`);

console.log(c.dim(`
  上の 4 行は root さえ手元にあれば成り立つ。紙に印刷した root でも成り立つ。
  **1 行の証明にチェーンは要らない。** ここを混ぜて説明すると話が壊れる。

  チェーンが効くのは下の 3 行だけで、しかもそれは
  「公開者以外の誰かが刻んだとき」に初めて意味を持つ。`));

// ── 実測: 誰が刻んだか ──────────────────────────────────────────
rule('実測 — 誰が刻んだか');

const chain = selectChain();
const conn = await connect({...chain, publicRpc: [anchored.rpc ?? deployed.rpc, ...chain.publicRpc]});
const events = (await getLogs(conn, {
  address: deployed.corpusAnchor,
  topics: [TOPIC.CorpusAnchored, corpus.corpusId],
})).map(decodeCorpusAnchored);

const byRoot = new Map();
for (const e of events) {
  const k = e.root.toLowerCase();
  if (!byRoot.has(k)) byRoot.set(k, new Set());
  byRoot.get(k).add(e.observer.toLowerCase());
}

const publisher = deployed.accounts.publisher.address.toLowerCase();
for (const [key, tree] of Object.entries(corpus.trees)) {
  const who = byRoot.get(tree.root.toLowerCase()) ?? new Set();
  const others = [...who].filter((a) => a !== publisher);
  const label = key === 'chapter' ? '54 帖' : '25,065 行';
  console.log(`  ${padTo(label, 12)} ${who.size} 人が刻んだ ` +
    (others.length > 0
      ? c.ok(`(公開者以外 ${others.length} 人 → 証人がいる)`)
      : c.warn('(公開者だけ → 署名で足りる)')));
}

console.log('');
console.log(`  ${padTo('刻んだ回数', 24)}${events.length} 回`);
console.log(`  ${padTo('使ったガス', 24)}${anchored.totalGas.toLocaleString('en-US')}`);
console.log(`  ${padTo('1 行ずつ刻んだ場合', 24)}${c.ng('約 6.9 億ガス')} ` +
  c.dim('(ブロック上限 3,000 万に収まらない)'));
console.log(`  ${padTo('置き換えたもの', 24)}${c.ok('root 32 バイト 1 個')}`);

// ── 永続化の側 ──────────────────────────────────────────────────
rule('実測 — 置き場所');

for (const q of perm.arweave.quotes) {
  console.log(`  ${padTo(q.label, 26)}${(q.bytes / 1024 / 1024).toFixed(1).padStart(6)} MB  ` +
    `${q.ar.toFixed(4).padStart(8)} AR  ${('¥' + q.jpy).padStart(6)}`);
}
console.log(`  ${c.dim('いずれも一度払えば置き続ける約束。ただし取り消せない')}`);
console.log(`  ${c.warn('この試作では計算しただけで、載せていない')}`);

// ── Gemini の 4 案の後始末 ──────────────────────────────────────
rule('出発点だった 4 案は、どうなったか');

const plans = [
  ['1. 校訂履歴の信頼性担保', T,
    'root を刻む形で実装した。ただし公開者が自分で刻むだけでは足りない'],
  ['2. 分散型校正 + トークンで貢献可視化', X,
    '貢献の判定を誰がするのかが決まらない。トークンは判定を代わりにやってくれない'],
  ['3. 写本・異文の NFT 化 (所有権)', X,
    '所有権を表すと、公有の本文に値段がつく。web3/positioning の発見2 で却下済み'],
  ['4. Web3 ストレージによる永続化', O,
    '本当の空白。¥100 で 23.7 MB が置ける。IPFS だけでは足りない (誰も持たなければ消える)'],
];
const W3 = [38, 10];
for (const [name, verdict, why] of plans) {
  console.log(`  ${padTo(name, W3[0])}${tint(verdict)(padTo(verdict, W3[1]))}`);
  console.log(`  ${c.dim('  ' + why)}`);
}

console.log(c.dim(`
  3 について 1 つだけ新しい論点がある。校異源氏物語の底本 (池田亀鑑 1942) は
  公有だが、**TEI のマークアップ・xml:id の付け方・和歌の同定は中村じしんの成果**である。
  NDL の所蔵資料と違い「持っていない権利を売る」形にはならない。
  それでも「所有」という枠に載せると公有の本文に値段がつくので、
  希少性を資料の側ではなく **行為の側** (校訂した / 検証した / 引用した) に
  置く形でなければ成り立たない。ここは positioning の発見2 の延長線上にある。`));

rule('結論');
console.log(`  ${c.b('1 行の証明は Merkle ツリーの働きで、チェーンは要らない。')}`);
console.log(`  ${c.b('チェーンが要るのは、その root を第三者が独立に刻めることだけ。')}`);
console.log('');
console.log(`  ${c.dim('自分の公開物を自分で刻むなら、git tag -s で足りる。')}`);
console.log(`  ${c.dim('意味が出るのは、他の研究者や図書館が同じ root を刻んだときである。')}`);
console.log(`  ${c.dim('つまりこれは技術の問題ではなく、誰に刻んでもらうかという運用の問題になる。')}`);
console.log('');
