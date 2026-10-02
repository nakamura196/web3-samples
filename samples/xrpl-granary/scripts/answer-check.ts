/**
 * 質問の振り分けが壊れていないかを確かめる。
 *
 * 用語や FAQ を足し引きすると、既存の質問が別の項目に流れることがある。
 * 講義の直前にそれに気づくのは避けたいので、代表的な打ち方を固定して回す。
 *
 *   npm run answer-check
 */

import { findAnswers } from '../src/lib/answer.ts';

interface Case {
  q: string;
  /** 当たってほしい項目の id。null なら「該当なし」が正解 */
  expect: string | null;
}

const CASES: Case[] = [
  // 素直な聞き方
  { q: 'XRPとトークンの違いは', expect: 'xrp-vs-token' },
  { q: 'XRP を送るのと発行するのはどう違う', expect: 'xrp-vs-token' },
  { q: 'tecPATH_DRYが出た', expect: 'tecpathdry' },
  { q: 'TakerGetsとTakerPaysどっち', expect: 'taker-confusion' },
  { q: 'リロードしたら鍵が消えた', expect: 'reload-lost' },
  { q: '残高がマイナスになってる', expect: 'balance-negative' },
  { q: '手数料は誰がもらうの', expect: 'fee-cost' },
  { q: 'ビットコインとの違い', expect: 'vs-bitcoin-ethereum' },
  { q: 'なぜ準備金が要るの', expect: 'reserve-why' },
  { q: 'スマートコントラクトいらないの', expect: 'no-contract' },
  { q: '発行体が倒産したらどうなる', expect: 'issuer-gone' },
  { q: 'faucet が失敗する', expect: 'faucet-fail' },

  // 用語の言い換え。別名や読みで拾えていること
  { q: 'トラストラインって何', expect: 'trustline' },
  { q: '信用線がわからない', expect: 'trustline' },
  { q: 'drops とは', expect: 'drops' },
  { q: 'IOU の意味', expect: 'iou' },
  { q: 'UNL とは', expect: 'unl' },

  // 用意していない質問は、無理に答えない
  { q: '今日の天気は', expect: null },
  { q: 'ラーメンの作り方', expect: null },
];

let failed = 0;

for (const c of CASES) {
  const r = findAnswers(c.q, 3);
  const top = r.hits[0];
  const gotId = r.confident ? (top?.id ?? null) : null;
  const ok = gotId === c.expect;
  if (!ok) failed++;
  const mark = ok ? '  ok  ' : ' FAIL ';
  const shown = gotId ?? '(該当なし)';
  console.log(
    `${mark}${c.q}\n        期待 ${c.expect ?? '(該当なし)'} / 実際 ${shown}` +
      (top ? ` (${top.score.toFixed(3)})` : ''),
  );
}

console.log(`\n${CASES.length - failed} / ${CASES.length} 通過`);
if (failed > 0) {
  console.error(`${failed} 件が期待と違う。lib/faq.ts と lib/glossary.ts の keywords を見直すこと。`);
  process.exit(1);
}
