/**
 * catalog/data.json から 1 枚の HTML を作る。**外部リソースを読み込まない。**
 *
 *   node scripts/13-catalog.mjs && node scripts/14-catalog-html.mjs
 *
 * ── 方針: 生のデータではなく意味を見せる ────────────────────────
 * Etherscan は汎用なので、名前と中身がずれたまま出る。実際につまずいた 6 つ:
 *
 *   DispenserCreated        何も作られていない (共有窓口への登録)
 *   1 of ○○                 個数ではなく背番号
 *   contract_deployed null  2 つ作られている
 *   Transfer (from 0x0)     発行のこと。Mint という表示は無い
 *   トークンページに DDO 無し 「移転ではないから」
 *   Holders が空            壊れていない。そういう設計
 *
 * この画面はこれらを **1 つも出さない**。代わりに何が言えるかだけを書く。
 * 生の値を見たい人のために、Etherscan と Sourcify へのリンクは添える。
 *
 * ── 単一ファイルにする理由 ──────────────────────────────────────
 * 索引サーバが落ちてカタログが消えた、というのが出発点だった。
 * この画面自身が誰かのサーバに依存していたら同じことになる。
 * データを埋め込んだ 1 枚の HTML にして、どこに置いても、
 * 何も動いていなくても開ける形にする。
 */
import {readJson, ROOT, rel} from '../lib/store.mjs';
import {c, rule} from '../lib/ui.mjs';
import fs from 'node:fs';
import path from 'node:path';

const d = readJson(path.join(ROOT, 'catalog', 'data.json'), 'node scripts/13-catalog.mjs');
const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[m]));
const n = (x) => Number(x).toLocaleString('en-US');
const short = (a) => `${a.slice(0, 10)}…${a.slice(-6)}`;
const ex = (p) => `${d.chain.explorer}/${p}`;

const anchorRows = d.anchor.records.map((r) => {
  const tree = r.root.toLowerCase() === d.corpus.trees.chapter.root.toLowerCase() ? '54 帖' : '25,065 行';
  const where = r.sourceUri.startsWith('ipfs://')
    ? '<span class="tag ok">IPFS</span>' : '<span class="tag">GitHub</span>';
  return `<tr><td>${tree}</td><td>${where}</td><td class="mono sm">${esc(r.sourceUri)}</td>
    <td class="num">${n(r.block)}</td><td><a href="${ex('tx/' + r.tx)}">見る</a></td></tr>`;
}).join('\n');

const txRows = d.transactions.map((t) => `<tr><td>${esc(t.label)}</td>
  <td class="num">${n(t.gas)}</td><td><a href="${ex('tx/' + t.txHash)}">${short(t.txHash)}</a></td></tr>`).join('\n');

const gwRows = d.ipfs.gateways.map((g) => `<li><span class="mono">${esc(g.gateway)}</span>
  ${g.ok ? `<span class="tag ok">取れて CID も一致</span> <span class="sm">${g.ms}ms</span>`
    : `<span class="tag ng">${esc(g.error ?? '失敗')}</span>`}</li>`).join('\n');

const checkRows = d.checks.map((k) => `<li>${k.ok ? '<span class="tag ok">ok</span>' : '<span class="tag ng">NG</span>'} ${esc(k.label)}</li>`).join('\n');

const html = `<title>校異源氏物語 witness</title>
<style>
:root{--bg:#fbfaf8;--fg:#1c1b19;--dim:#6b6862;--line:#e0ddd6;--card:#fff;
  --ok:#1f7a4d;--ng:#a12d2d;--accent:#7a4f1f;--tag:#f0ece4}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#161513;--fg:#e9e6e0;--dim:#9a958c;--line:#302e2a;--card:#1e1d1a;
  --ok:#5fbf8c;--ng:#e08585;--accent:#d4a464;--tag:#2a2825}}
:root[data-theme="dark"]{--bg:#161513;--fg:#e9e6e0;--dim:#9a958c;--line:#302e2a;--card:#1e1d1a;
  --ok:#5fbf8c;--ng:#e08585;--accent:#d4a464;--tag:#2a2825}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
  font-family:"Hiragino Mincho ProN","Yu Mincho",Georgia,serif;line-height:1.85;
  font-size:16px;-webkit-text-size-adjust:100%}
.wrap{max-width:820px;margin:0 auto;padding:48px 20px 96px}
h1{font-size:1.9rem;margin:0 0 .2em;letter-spacing:.02em;font-weight:600}
h2{font-size:1.15rem;margin:3em 0 .8em;padding-bottom:.35em;border-bottom:1px solid var(--line);font-weight:600}
h3{font-size:1rem;margin:2em 0 .5em;color:var(--accent);font-weight:600}
p{margin:0 0 1em}
.lede{color:var(--dim);margin:0 0 2.5em;font-size:.95rem}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.82em;word-break:break-all}
.sm{font-size:.85em;color:var(--dim)}
.num{text-align:right;font-variant-numeric:tabular-nums;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.85em}
a{color:var(--accent)}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:20px 22px;margin:1.2em 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin:1.2em 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px}
.stat .k{font-size:.78rem;color:var(--dim);margin-bottom:.3em}
.stat .v{font-size:1.35rem;font-variant-numeric:tabular-nums;font-weight:600}
.stat .n{font-size:.78rem;color:var(--dim);margin-top:.2em}
.tag{display:inline-block;background:var(--tag);color:var(--dim);border-radius:5px;
  padding:1px 8px;font-size:.75rem;font-family:ui-monospace,monospace;vertical-align:middle}
.tag.ok{color:var(--ok)}.tag.ng{color:var(--ng)}
table{width:100%;border-collapse:collapse;font-size:.9rem;margin:.8em 0}
th{text-align:left;color:var(--dim);font-weight:600;font-size:.78rem;
  border-bottom:1px solid var(--line);padding:6px 10px 6px 0}
td{padding:7px 10px 7px 0;border-bottom:1px solid var(--line);vertical-align:top}
.scroll{overflow-x:auto}
ul.plain{list-style:none;padding:0;margin:.6em 0}
ul.plain li{padding:5px 0;border-bottom:1px solid var(--line)}
ul.plain li:last-child{border:0}
.warn{border-left:3px solid var(--accent);padding:2px 0 2px 16px;margin:1.4em 0;color:var(--dim)}
.flow{font-family:ui-monospace,monospace;font-size:.8rem;line-height:1.9;
  background:var(--card);border:1px solid var(--line);border-radius:10px;
  padding:18px 20px;overflow-x:auto;white-space:pre;color:var(--dim)}
footer{margin-top:4em;padding-top:1.4em;border-top:1px solid var(--line);
  color:var(--dim);font-size:.82rem}
</style>
<div class="wrap">

<h1>校異源氏物語 — 検証できるカタログ</h1>
<p class="lede">TEI/XML ${n(d.corpus.chapters)} 帖・${n(d.corpus.lines)} 行。ライセンスは ${esc(d.corpus.license)}。<br>
このページは<strong>索引サーバを 1 つも使わずに</strong>作られています。
Ocean のノードも Aquarius も The Graph も呼んでいません。使ったのは JSON-RPC と HTTP GET だけです。</p>

<div class="grid">
  <div class="stat"><div class="k">本文</div><div class="v">${n(d.corpus.bytes)}</div><div class="n">バイト / ${d.ipfs.files} ファイル</div></div>
  <div class="stat"><div class="k">証明できる単位</div><div class="v">1 行</div><div class="n">645 バイトで渡せる</div></div>
  <div class="stat"><div class="k">チェーン上の記録</div><div class="v">${d.anchor.records.length} 件</div><div class="n">誰も消せない</div></div>
  <div class="stat"><div class="k">独立した第三者</div><div class="v" style="color:var(--ng)">${d.anchor.independentWitnesses} 人</div><div class="n">ここが最大の穴</div></div>
</div>

<h2>3 つの経路が同じものを指しています</h2>
<p>この資料は 3 か所に記録があります。どこから辿っても、同じ本文に行き着きます。</p>

<div class="flow">     チェーン上の記録              Ocean の目録               本文の置き場所
   CorpusAnchor              data NFT                   IPFS
   ${short(d.anchor.contract)}     ${short(d.nft.address)}      ${d.ipfs.cid.slice(0, 12)}…
          │                        │                          │
     root 2 本                 DDO ${n(d.ddo.bytes)} バイト              ${d.ipfs.files} ファイル
     行き先 2 通り              （平文。復号が要らない）        ${n(d.corpus.bytes)} バイト
          │                        │                          │
          └────────────┬───────────┘                          │
                       ▼                                      │
              同じ root・同じ CID ──────────────────────────────┘
                       │
                取り出して計算し直すと、同じ root になる</div>

<h3>突き合わせた結果</h3>
<ul class="plain">
${checkRows}
</ul>

<h2>本文</h2>
<p>内容そのものが住所になっている形（CID）で置いてあります。誰がどこで配っていても、同じ住所で引けます。</p>
<div class="card">
<p class="mono">${esc(d.ipfs.uri)}</p>
<p class="sm">公開ゲートウェイから実際に取り出し、こちらで計算し直して一致を確かめたもの:</p>
<ul class="plain">
${gwRows}
</ul>
</div>
<p class="warn">IPFS に載っていることは「消えない」を意味しません。CID は内容が同じかを保証するだけで、
持ち続ける人がいなければ取れなくなります。いまは Filebase の無料枠に乗っています。</p>

<h2>版の固定</h2>
<p>${n(d.corpus.lines)} 行を 1 個の値にまとめた root を、チェーンに刻んであります。
本文が 1 文字でも変われば、この値は完全に別物になります。</p>
<div class="card">
<p class="sm">54 帖の root</p><p class="mono">${esc(d.corpus.trees.chapter.root)}</p>
<p class="sm" style="margin-top:1em">25,065 行の root</p><p class="mono">${esc(d.corpus.trees.item.root)}</p>
<p class="sm" style="margin-top:1em">方式 ${esc(d.corpus.trees.item.spec)}　素材 <span class="mono">${esc(d.corpus.sourceCommit)}</span></p>
</div>
<div class="scroll"><table>
<tr><th>対象</th><th>行き先</th><th>指している場所</th><th>ブロック</th><th></th></tr>
${anchorRows}
</table></div>
<p class="sm">同じ root に記録が 2 つ並んでいます。<strong>上書きではありません。</strong>
記録を保存する変数を 1 つも持たない造りなので、上書きという操作が存在しません。
「本文はこの両方の場所にあった」という事実が 2 つ残っています。</p>
<p class="sm">コントラクトのソースは <a href="${esc(d.anchor.verifiedSource)}">Sourcify で検証済み</a>です
（<code>exact_match</code>）。チェーン上のコードが公開されているソースから出たものだと、第三者が確かめられます。</p>

<h2>目録（Ocean）</h2>
<p>この資料には Ocean の目録が付いています。ただし<strong>読むのに券は要りません</strong>。
CC0 の本文に関所を作らないよう、無料かつ暗号化なしで出してあります。</p>
<div class="card">
<ul class="plain">
<li>目録の名前　<span class="mono">${esc(d.nft.name)}</span>（<a href="${ex('address/' + d.nft.address)}">${short(d.nft.address)}</a>）</li>
<li>公開者の役　<span class="mono">${short(d.nft.owner)}</span>　<span class="sm">メタデータを書き換える権利を持つ人</span></li>
<li>引ける名前　<span class="mono">${esc(d.ddo.did)}</span></li>
<li>メタデータ　${n(d.ddo.bytes)} バイト、<span class="tag ok">暗号化なし</span>　<span class="sm">チェーン上に平文。読む側にサーバが要らない</span></li>
<li>利用の記録　いまのところ 0 件　<span class="sm">注文されるとチェーンに残る</span></li>
</ul>
</div>
<p class="sm">Ocean は「利用 1 回分の券」という仕組みを持っていますが、券は誰の手元にも残りません。
注文の瞬間に発行され、記録され、同じ取引の中で焼かれます。
数えているのは所有ではなく<strong>利用の回数</strong>です。</p>
<p class="warn">この目録は Ocean Market には出てきません。
Ocean の索引サーバ（<span class="mono">api.nodes.oceanprotocol.com</span>）が停止しているためです。
このページが索引サーバを使わずに作られているのは、それが理由です。</p>

<h2>正直な留保</h2>
<ul class="plain">
${d.caveats.map((x) => `<li>${esc(x)}</li>`).join('\n')}
</ul>
<p class="sm">とくに 1 つめが重要です。公開者が自分で自分の版を刻むだけなら、チェーンは要りません
（<code>git tag -s</code> で足ります）。この仕組みが意味を持つのは、
<strong>公開者以外の誰かが独立に同じ root を刻んだとき</strong>です。いまはまだ 0 人です。</p>

<h2>チェーンに送ったもの</h2>
<div class="scroll"><table>
<tr><th>したこと</th><th>ガス</th><th>取引</th></tr>
${txRows}
<tr><td><strong>合計</strong></td><td class="num"><strong>${n(d.transactions.reduce((a, t) => a + t.gas, 0))}</strong></td><td></td></tr>
</table></div>
<p class="sm">本文そのものはチェーンに載せていません。${n(d.corpus.bytes)} バイトを載せると約 9,400 万ガスかかり、
ブロックの上限 3,000 万の 3 倍以上で収まりません。載せてあるのは root 64 バイトと目録だけです。</p>

<footer>
${esc(d.chain.name)}（chainId ${d.chain.chainId}）／ ${esc(d.corpus.author)}<br>
生成 ${esc(d.generatedAt.slice(0, 19).replace('T', ' '))} UTC　—　
索引サーバを使わずに <span class="mono">scripts/13-catalog.mjs</span> が組み立てました。
</footer>
</div>`;

fs.writeFileSync(path.join(ROOT, 'catalog', 'index.html'), html);
rule('カタログの画面を作りました');
console.log(`  ${rel(path.join(ROOT, 'catalog', 'index.html'))}  ${(html.length / 1024).toFixed(1)} KB`);
console.log(`  ${c.dim('外部リソースを 1 つも読み込みません。どこに置いても開けます。')}`);
console.log(`  ${c.dim('確認: open ' + rel(path.join(ROOT, 'catalog', 'index.html')))}`);
