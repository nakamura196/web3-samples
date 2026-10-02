/**
 * 「何もしなければ消える」を数字にする。**何も送信しない。**
 *
 *   node scripts/04-permanence.mjs
 *   node scripts/04-permanence.mjs --offline    価格を取りに行かない
 *
 * ── なぜこれが空白なのか ────────────────────────────────────────
 * 校異源氏物語のサイトは GitHub Pages で公開されている。無料で速いが、
 * **誰かが払い続け、誰かが消さないことを前提にしている**。加えて
 * docs/snorql/ の SPARQL 検索は外部の Dydra というサービスを呼んでいて、
 * そこが止まれば検索は動かなくなる (本文は残るが、引ける状態ではなくなる)。
 *
 * ここで出すのは 2 通りの「置き場所」の性質と値段である。
 *
 *   IPFS     内容から住所が決まる (CID)。ただし **誰かが持ち続けないと消える**
 *   Arweave  一度払えば置き続ける約束。ただし **取り消せない**
 *
 * ── 何を送信しないか、明示する ──────────────────────────────────
 * このスクリプトは CID を**手元で計算するだけ**で、IPFS に載せない。
 * Arweave には値段を尋ねるだけで、載せない。載せると取り消せないため、
 * 実際に投じるかは別の判断として切り離してある。
 */
import {fileCid, dirCid, CHUNK} from '../lib/cid.mjs';
import {readCorpus} from '../lib/tei.mjs';
import {requireRepo, GENJI_REPO} from '../lib/source.mjs';
import {readCorpusOut, writeJson, OUT, rel} from '../lib/store.mjs';
import {c, rule, head, padTo, argOf} from '../lib/ui.mjs';
import fs from 'node:fs';
import path from 'node:path';

const offline = process.argv.includes('--offline');

// 2026-08-25 に取得した値。--offline や取得失敗のときに使う
const RECORDED = {
  at: '2026-08-25',
  arUsd: 2.25,
  usdJpy: 159.35,
  winstonPerByte: 67386525089 / (6 * 1024 * 1024), // 6 MB の見積りから逆算
};
const WINSTON = 1e12; // 1 AR

rule('置き場所と値段 — 何も送信しない');
console.log(`  ${c.warn('このスクリプトは IPFS にも Arweave にも一切載せません。')}`);
console.log(`  ${c.dim('CID は手元で計算し、Arweave には値段だけ尋ねます。')}`);
console.log(`  ${c.dim('Arweave への投入は取り消せないので、実際に払うかは別の判断です。')}`);

// ── 54 帖の CID ─────────────────────────────────────────────────
head('54 帖の CID (手元で計算)');

const corpus = readCorpus(requireRepo());
const files = corpus.map((ch) => ({name: ch.name, cid: fileCid(ch.bytes)}));
const teiBytes = corpus.reduce((n, ch) => n + ch.bytes.length, 0);
const oversized = files.filter((f) => f.cid.codec === 'dag-pb');

console.log(`  ファイル   ${files.length}`);
console.log(`  合計       ${teiBytes.toLocaleString('en-US')} バイト`);
console.log(`  単一ブロック ${files.length - oversized.length} 本 ` +
  `(${(CHUNK / 1024)} KiB 以下 → CIDv1 / raw)`);
console.log(`  DAG        ${oversized.length} 本 (超えるので UnixFS の dag-pb)`);

// 01-digest が出した CID と一致するか。同じものを 2 回計算して食い違いを見る
const recorded = readCorpusOut();
const mismatch = files.filter((f, i) => f.cid.cid !== recorded.chapters[i].cid);
console.log(`  01-digest の結果と ${mismatch.length === 0 ? c.ok('一致') : c.ng(mismatch.length + ' 件不一致')}`);

console.log('');
console.log(c.dim('  256 KiB を超えた 4 本:'));
for (const f of oversized) {
  console.log(`  ${padTo(f.name, 9)} ${String(f.cid.bytes).padStart(7)} バイト → ` +
    `${f.cid.chunks} チャンク + 中間ノード ${f.cid.nodeBytes} バイト`);
  console.log(`  ${c.dim('          ' + f.cid.cid)}`);
}

// ── ディレクトリ 1 段 ───────────────────────────────────────────
head('xml/master/ 全体を 1 つの住所にする');
const dir = dirCid(files);
console.log(`  CID        ${dir.cid}`);
console.log(`  リンク     ${dir.links} 本 (名前順)`);
console.log(`  DAG 全体   ${dir.dagSize.toLocaleString('en-US')} バイト`);
console.log('');
console.log(`  ${c.warn('この 2 つは手元の実装が仕様どおりか照合できていません')}`);
console.log(`    ${c.dim('・複数チャンクを繋ぐ Links の部分 (4 帖)')}`);
console.log(`    ${c.dim('・ディレクトリの Links の並び順と Tsize')}`);
console.log(`  ${c.dim('照合の方法: ipfs add -r --cid-version=1 --raw-leaves xml/master/ の出力と比べる')}`);
console.log(`  ${c.dim('手元に ipfs のコマンドが無いため、この試作では未実施 (空のディレクトリ・')}`);
console.log(`  ${c.dim('空のファイルの公開値との照合までは 00-selftest で通っている)')}`);

// ── サイト全体の重さ ────────────────────────────────────────────
head('サイト全体の重さ');

function dirSize(root) {
  let bytes = 0, count = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, {withFileTypes: true})) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== '.git') walk(p); }
      else if (e.isFile()) { bytes += fs.statSync(p).size; count++; }
    }
  };
  if (!fs.existsSync(root)) return null;
  walk(root);
  return {bytes, count};
}

const docs = dirSize(path.join(GENJI_REPO, 'docs'));
const targets = [
  {key: 'tei', label: 'TEI 本文 (xml/master)', bytes: teiBytes, count: files.length},
  docs && {key: 'site', label: 'サイト全体 (docs)', bytes: docs.bytes, count: docs.count},
].filter(Boolean);

for (const t of targets) {
  console.log(`  ${padTo(t.label, 28)} ${(t.bytes / 1024 / 1024).toFixed(1).padStart(6)} MB  ` +
    c.dim(`${t.count.toLocaleString('en-US')} ファイル`));
}

// ── Arweave の値段 ──────────────────────────────────────────────
head('Arweave に一度だけ払う場合');

async function quote(bytes) {
  if (offline) return null;
  try {
    const res = await fetch(`https://arweave.net/price/${bytes}`, {signal: AbortSignal.timeout(8000)});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Number((await res.text()).trim());
  } catch {
    return null;
  }
}

let source = 'live';
const quotes = [];
for (const t of targets) {
  let winston = await quote(t.bytes);
  if (winston === null) {
    source = offline ? 'recorded (--offline)' : 'recorded (取得できず)';
    winston = Math.round(t.bytes * RECORDED.winstonPerByte);
  }
  quotes.push({...t, winston});
}

const ar = RECORDED.arUsd;
const jpy = RECORDED.usdJpy;
console.log(`  見積り元   ${source === 'live' ? 'arweave.net/price' : source}`);
console.log(`  換算       1 AR = $${ar} / $1 = ¥${jpy}  ${c.dim(`(${RECORDED.at} 時点の記録値)`)}`);
console.log('');
console.log(c.dim('  対象                            AR        円     一度払えば'));
for (const q of quotes) {
  const arAmount = q.winston / WINSTON;
  console.log(`  ${padTo(q.label, 28)} ${arAmount.toFixed(4).padStart(8)}  ` +
    `${('¥' + Math.round(arAmount * ar * jpy)).padStart(7)}     ${c.dim('置き続ける約束')}`);
}
console.log('');
console.log(`  ${c.dim('円の額は換算レート次第で動く。桁を見るための数字として読むこと。')}`);

// ── 何が守られて、何が守られないか ──────────────────────────────
head('この 2 つで守られること / 守られないこと');
const rows = [
  ['本文のバイト列が変わっていないこと', 'CID だけで分かる', true],
  ['GitHub が消えても本文が引けること', 'Arweave なら残る', true],
  ['どの版がいつの版か', 'root を刻んだ記録が要る (02-anchor)', true],
  ['第三者が「同じものを見た」と言えること', '同上。CID だけでは言えない', true],
  ['SPARQL 検索が動き続けること', c.warn('守られない — 外部サービス依存'), false],
  ['IIIF ビューアが動き続けること', c.warn('守られない — 静的化するなら別作業'), false],
  ['間違いを直せること', c.warn('Arweave は取り消せない。新しい版を足す形になる'), false],
];
for (const [what, how, ok] of rows) {
  console.log(`  ${ok ? c.ok('○') : c.warn('×')} ${padTo(what, 40)} ${c.dim(how)}`);
}

console.log('');
console.log(`  ${c.b('IPFS だけでは永続化にならない。')}`);
console.log(`  ${c.dim('CID は「内容が同じか」を保証するだけで、持ち続ける人がいなければ消える。')}`);
console.log(`  ${c.dim('「消えない」を買うのが Arweave で、そこで初めてお金の話になる。')}`);

const outFile = path.join(OUT, 'permanence.json');
writeJson(outFile, {
  uploaded: false,
  note: 'CID は手元で計算しただけ。IPFS にも Arweave にも載せていない',
  unverified: [
    '複数チャンクの dag-pb ファイルノード (4 帖)',
    'ディレクトリノードの Links の並びと Tsize',
  ],
  verifyWith: 'ipfs add -r --cid-version=1 --raw-leaves xml/master/',
  chunkSize: CHUNK,
  directory: {path: 'xml/master', ...dir},
  files: files.map((f) => ({name: f.name, bytes: f.cid.bytes, codec: f.cid.codec,
    chunks: f.cid.chunks, cid: f.cid.cid, dagSize: f.cid.dagSize})),
  arweave: {
    priceSource: source,
    rates: {arUsd: ar, usdJpy: jpy, at: RECORDED.at},
    quotes: quotes.map((q) => ({target: q.key, label: q.label, bytes: q.bytes,
      winston: q.winston, ar: q.winston / WINSTON,
      jpy: Math.round((q.winston / WINSTON) * ar * jpy)})),
  },
});

console.log('');
console.log(`  ${rel(outFile)} に書きました。${c.dim('(送信の記録ではなく、見積りの記録)')}`);
console.log('');
console.log('次:');
console.log('  node scripts/05-compare.mjs    チェーンが要る行だけを取り出す');
