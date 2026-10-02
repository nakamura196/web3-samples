/**
 * 2 本の root をチェーンに刻む。
 *
 *   node scripts/02-anchor.mjs
 *
 * ── ここが ndl-witness と立場が逆になるところ ────────────────────
 * ndl-witness では、中村は NDL の公開物を外から観測する **第三者**だった。
 * 「その日その URL がこう返した」と第三者が刻むから、後で NDL が黙って
 * 差し替えたときに突き合わせる相手ができる。証人として意味があった。
 *
 * 校異源氏物語では、中村は **公開している側**である。
 * 自分の公開物の版を自分で刻んでも、証人はいない。刻んだ本人が
 * 後から別の root を刻み直せるし、どちらが本物かを言う第三者がいない。
 * **これは署名付きタグ (git tag -s) で足りる範囲で、チェーンは要らない。**
 *
 * では何のために刻むのか。**第三者が同じ root を独立に刻めるから**である。
 * ここでは 3 回刻む:
 *
 *   1 回目  公開者 (中村)     … 「2026-08-25 時点の版はこれ」
 *   2 回目  第三者 A (研究者) … 手元で 01-digest を走らせて同じ root が出た
 *   3 回目  第三者 B (図書館) … 同上
 *
 * root が一致した記録が独立に 3 つ並ぶ、という状態がチェーンでしか作れない。
 * 中村が後から履歴を消すことも、A と B の記録を書き換えることもできない。
 * 「消せない」「第三者が足せる」の 2 つだけが、チェーンが要る理由である。
 *
 * ── 25,065 件を個別に刻まない理由 ───────────────────────────────
 * ndl-witness の anchor は 1 回 27,436 ガス。25,065 件だと約 6.9 億ガスで、
 * ブロックのガス上限 (3,000 万) にまるで収まらない。
 * root 1 個なら 1 回で済み、1 行の証明は 480 バイトの経路で後から作れる。
 */
import {SIG, TOPIC, encodeCall, decodeCorpusAnchored} from '../lib/abi.mjs';
import {selectChain} from '../lib/chains.mjs';
import {connect, sendTx, waitReceipt, getLogs, gasUsed} from '../lib/rpc.mjs';
import {readCorpusOut, readDeployed, writeJson, anchoredFile, rel} from '../lib/store.mjs';
import {c, rule, head, padTo} from '../lib/ui.mjs';

const corpus = readCorpusOut();
const deployed = readDeployed();
const chain = selectChain();
const conn = await connect(chain);

rule('root を刻む');
console.log(`  チェーン     ${chain.name} (chainId ${chain.chainId})`);
console.log(`  CorpusAnchor ${deployed.corpusAnchor}`);
console.log(`  資料         ${corpus.corpusUri}`);
console.log(`  corpusId     ${corpus.corpusId}`);
console.log(`  素材         ${corpus.source.commit ?? '(commit 不明)'}`);

const capturedAt = Math.floor(Date.parse(corpus.capturedAt) / 1000);

// 刻む相手: 2 本のツリー × 3 人
const trees = [
  {key: 'chapter', label: '54 帖', ...corpus.trees.chapter},
  {key: 'item', label: '25,065 行', ...corpus.trees.item},
];
const actors = [
  {key: 'publisher', ...deployed.accounts.publisher},
  {key: 'witnessA', ...deployed.accounts.witnessA},
  {key: 'witnessB', ...deployed.accounts.witnessB},
];

const ARG_TYPES = ['bytes32', 'bytes32', 'uint64', 'uint32', 'string', 'string'];
const records = [];

for (const tree of trees) {
  head(`${tree.label} — root ${tree.root.slice(0, 18)}…`);
  console.log(`  方式         ${tree.spec}`);
  console.log(`  treeSize     ${tree.treeSize.toLocaleString('en-US')}`);
  console.log('');

  for (const actor of actors) {
    const data = encodeCall(SIG.anchor, ARG_TYPES, [
      corpus.corpusId, tree.root, capturedAt, tree.treeSize,
      corpus.source.sourceUri, tree.spec,
    ]);
    const txHash = await sendTx(conn, {from: actor.address, to: deployed.corpusAnchor, data});
    const receipt = await waitReceipt(conn, txHash);
    const gas = gasUsed(receipt);
    records.push({tree: tree.key, root: tree.root, treeSize: tree.treeSize, spec: tree.spec,
      actor: actor.key, role: actor.role, address: actor.address, txHash, gas});
    console.log(`  ${padTo(actor.role, 32)} ${gas.toLocaleString('en-US').padStart(8)} ガス  ` +
      c.dim(txHash.slice(0, 18) + '…'));
  }
}

// ── チェーンから読み直す ────────────────────────────────────────
// 書いた値をそのまま信じない。ログを読み直して、独立した記録が並んでいることを確かめる
head('チェーンから読み直す');

const logs = await getLogs(conn, {
  address: deployed.corpusAnchor,
  topics: [TOPIC.CorpusAnchored, corpus.corpusId],
});
const events = logs.map(decodeCorpusAnchored);
console.log(`  CorpusAnchored ${events.length} 件`);
console.log('');
console.log(c.dim('  block  treeSize   刻んだ人                          root'));
for (const e of events) {
  const who = actors.find((a) => a.address.toLowerCase() === e.observer.toLowerCase());
  console.log(`  ${String(e.blockNumber).padStart(5)} ${String(e.treeSize).padStart(9)}   ` +
    `${padTo(who?.role ?? e.observer, 32)} ${c.dim(e.root.slice(0, 18) + '…')}`);
}

// 同じ root を刻んだ人が何人いるか。ここが「第三者が足せる」の実体
head('root ごとに、独立に刻んだ人の数');
for (const tree of trees) {
  const same = events.filter((e) => e.root.toLowerCase() === tree.root.toLowerCase());
  const distinct = new Set(same.map((e) => e.observer.toLowerCase()));
  const ok = distinct.size >= 2;
  console.log(`  ${padTo(tree.label, 12)} ${distinct.size} 人  ` +
    (ok ? c.ok('公開者以外の記録がある') : c.warn('公開者だけ — 署名で足りる範囲')));
}

console.log('');
console.log(`  ${c.dim('刻んだ本人でも、この履歴は消せない。「最新の root」という変数を')}`);
console.log(`  ${c.dim('持たない設計にしてあるので、上書きという操作が存在しない')}`);

const total = records.reduce((n, r) => n + r.gas, 0);
head('費用');
console.log(`  合計 ${total.toLocaleString('en-US')} ガス (${records.length} 回)`);
console.log(`  ${c.dim(`個別に 25,065 件刻んだ場合の見積り: 約 ${Math.round(25065 * 27436 / 1e8 * 10) / 10} 億ガス`)}`);
console.log(`  ${c.dim('ブロックのガス上限 3,000 万にまるで収まらない。root 1 個で置き換えている')}`);

writeJson(anchoredFile(), {
  chainId: chain.chainId,
  corpusAnchor: deployed.corpusAnchor,
  corpusUri: corpus.corpusUri,
  corpusId: corpus.corpusId,
  capturedAt: corpus.capturedAt,
  sourceUri: corpus.source.sourceUri,
  trees: corpus.trees,
  anchors: records,
  totalGas: total,
});

console.log('');
console.log(`  ${rel(anchoredFile())} に書きました。`);
console.log('');
console.log('次:');
console.log('  node scripts/03-prove.mjs 1001-01     1 行だけを、チェーン上で検証する');
