/**
 * 54 帖と 25,065 行から、2 本の Merkle ツリーを組む。
 *
 *   node scripts/01-digest.mjs
 *
 * ── なぜ 2 本なのか ─────────────────────────────────────────────
 * 証明したい主張が 2 通りあるため。
 *
 *   帖ツリー (葉 54)      「桐壺の TEI ファイルは、この版ではこの内容だった」
 *   行ツリー (葉 25,065)  「この URI の 1 行は、この版ではこの本文だった」
 *
 * 帖ツリーの葉は **ファイルのバイト列そのまま**。git が持っているものと同じ粒度で、
 * ファイル全体を渡せる相手に対してはこれで足りる。
 *
 * 行ツリーの葉は **URI + 0x00 + seg の中身**。こちらが本題で、
 * 論文で 1 行だけ引用した人が、5.87 MB を渡さずに版を証明できる。
 * git はこの粒度を持たない (blob は帖 1 本まるごと = 最大 309 KB)。
 *
 * ── 出力 ────────────────────────────────────────────────────────
 *   out/corpus.json  帖ごとの digest・CID、2 本の root、統計
 *   out/leaves.json  25,065 件の葉ハッシュ (後の版と突き合わせて差分を出すため)
 */
import {hex, idOf, b32} from '../lib/sha.mjs';
import * as merkle from '../lib/merkle.mjs';
import {fileCid} from '../lib/cid.mjs';
import {readCorpus, flattenItems, itemEntry, ENTRY_SPEC, CORPUS_URI} from '../lib/tei.mjs';
import {requireRepo, gitHead, GENJI_REPO} from '../lib/source.mjs';
import {writeJson, corpusFile, leavesFile, rel} from '../lib/store.mjs';
import {c, rule, head, padTo} from '../lib/ui.mjs';

const CHAPTER_SPEC = `${merkle.SPEC}/chapter-file-bytes`;
const ITEM_SPEC = `${merkle.SPEC}/${ENTRY_SPEC}`;

rule('校異源氏物語の版を固定する');

const masterDir = requireRepo();
const git = gitHead();

console.log(`  素材      ${GENJI_REPO}`);
console.log(`  commit    ${git.sha ?? c.warn('不明 (git の情報が読めない)')}`);
console.log(`  正規化    ${c.dim('なし。ファイルのバイト列をそのまま使う')}`);
console.log(`            ${c.dim('相手が API ではなくリポジトリの中のファイルなので、揺れる余地がない')}`);

// ── 帖ツリー ────────────────────────────────────────────────────
head('54 帖 — ファイルのバイト列');

const corpus = readCorpus(masterDir);
const chapters = corpus.map((ch) => {
  const leaf = merkle.leafHash(ch.bytes);
  const cid = fileCid(ch.bytes);
  return {
    name: ch.name,
    bytes: ch.bytes.length,
    segs: ch.segs.length,
    leafHash: hex(leaf),
    cid: cid.cid,
    cidCodec: cid.codec,
    cidChunks: cid.chunks,
  };
});
const chapterLeaves = corpus.map((ch) => merkle.leafHash(ch.bytes));
const chapterRoot = merkle.root(chapterLeaves);

const totalBytes = chapters.reduce((n, ch) => n + ch.bytes, 0);
const overSized = chapters.filter((ch) => ch.cidCodec === 'dag-pb');

console.log(`  帖        ${chapters.length}`);
console.log(`  合計      ${totalBytes.toLocaleString('en-US')} バイト`);
console.log(`  root      ${b32(chapterRoot)}`);
console.log(`  方式      ${CHAPTER_SPEC}`);
console.log(`  証明の長さ 最大 ${merkle.proofLength(chapters.length)} ハッシュ ` +
  `(${merkle.proofLength(chapters.length) * 32} バイト)`);

if (overSized.length > 0) {
  console.log('');
  console.log(`  ${c.warn('256 KiB を超える帖が ' + overSized.length + ' 本ある')} ` +
    c.dim('→ CID は単一ブロックではなく UnixFS の DAG になる'));
  for (const ch of overSized) {
    console.log(`    ${padTo(ch.name, 10)} ${String(ch.bytes).padStart(8)} バイト ` +
      `→ ${ch.cidChunks} チャンク  ${c.dim(ch.cid)}`);
  }
  console.log(`  ${c.dim('ndl-witness が「未対応」として例外を投げていたのがここ。lib/cid.mjs で実装した')}`);
}

// ── 行ツリー ────────────────────────────────────────────────────
head('25,065 行 — URI + 0x00 + seg の中身');

const items = flattenItems(corpus);
const entries = items.map((it) => itemEntry(it.corresp, it.inner));
const itemLeaves = entries.map(merkle.leafHash);
const itemRoot = merkle.root(itemLeaves);

const entryBytes = entries.reduce((n, e) => n + e.length, 0);
const proofLen = merkle.proofLength(items.length);

console.log(`  行        ${items.length.toLocaleString('en-US')}`);
console.log(`  葉の合計  ${entryBytes.toLocaleString('en-US')} バイト`);
console.log(`  root      ${b32(itemRoot)}`);
console.log(`  方式      ${ITEM_SPEC}`);
console.log(`  証明の長さ 最大 ${proofLen} ハッシュ (${proofLen * 32} バイト)`);
console.log('');
console.log(`  ${c.b('1 行を証明するのに渡すもの')}`);
console.log(`    本文 5.87 MB  →  ${proofLen * 32} バイト + その行そのもの`);
console.log(`    ${c.dim('チェーンに載るのは root 32 バイト 1 個だけ')}`);

// ── 帖ごとの内訳 ────────────────────────────────────────────────
head('帖ごとの内訳 (先頭 5 帖と末尾 3 帖)');
console.log(c.dim('  帖        バイト     行     CID の形'));
const show = [...chapters.slice(0, 5), null, ...chapters.slice(-3)];
for (const ch of show) {
  if (!ch) { console.log(c.dim('  …')); continue; }
  console.log(`  ${padTo(ch.name, 10)}${String(ch.bytes).padStart(8)} ${String(ch.segs).padStart(6)}     ${ch.cidCodec}`);
}

// ── 書き出し ────────────────────────────────────────────────────
const corpusId = idOf(CORPUS_URI);
const sourceUri = git.sha
  ? `https://github.com/kouigenjimonogatari/kouigenjimonogatari.github.io/tree/${git.sha}`
  : GENJI_REPO;

const out = {
  corpusUri: CORPUS_URI,
  corpusId,
  capturedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  source: {repo: GENJI_REPO, commit: git.sha, ref: git.ref, sourceUri},
  digestAlgorithm: 'SHA-256',
  canonicalization: 'none (file bytes as committed)',
  trees: {
    chapter: {
      spec: CHAPTER_SPEC,
      treeSize: chapters.length,
      root: b32(chapterRoot),
      proofLength: merkle.proofLength(chapters.length),
    },
    item: {
      spec: ITEM_SPEC,
      treeSize: items.length,
      root: b32(itemRoot),
      proofLength: proofLen,
    },
  },
  totals: {chapterBytes: totalBytes, entryBytes, overSizedChapters: overSized.length},
  chapters,
};

writeJson(corpusFile(), out);
writeJson(leavesFile(), {
  spec: ITEM_SPEC,
  treeSize: items.length,
  root: b32(itemRoot),
  // 本文は複製しない (素材のリポジトリが持っている)。突き合わせに要るのは URI と葉ハッシュ
  items: items.map((it, i) => [it.chapter, it.corresp, hex(itemLeaves[i])]),
});

console.log('');
console.log(`  ${rel(corpusFile())} と ${rel(leavesFile())} に書きました。`);
console.log('');
console.log('次:');
console.log('  ./scripts/dev.zsh          別の端末で anvil を立てて配置する');
console.log('  node scripts/02-anchor.mjs');
