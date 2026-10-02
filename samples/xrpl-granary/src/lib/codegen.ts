/**
 * 「コードを生成」— 実行時の本物の値を差し込んで、走らせるコードを組み立てる。
 *
 * 原典のデモ (xrpl-ubc-demo) の Generate Code も、中身はテンプレートへの値の
 * 差し込みである。LLM は要らない。ただしあちらが差し込めるのはフォームに
 * 入力した値だけで、こちらは ① で実際に生成された口座のアドレスを差し込める。
 * 「自分の口座が書かれたコード」が出てくるほうが、演習としては効く。
 *
 * まだ ① を実行していない場合は、アドレスの位置にプレースホルダを出す。
 */

import { CURRENCY, TESTNET_WS } from './ledger.ts';
import {
  ISSUE_AMOUNT,
  OFFER_AMOUNT,
  OFFER_PRICE_XRP,
  TAKE_AMOUNT,
  TAKE_PRICE_XRP,
  TRUST_LIMIT,
  type Actors,
} from './scenario.ts';

export type StepId = 'wallets' | 'issuer' | 'trust' | 'issue' | 'offer' | 'settle';

/** 差し込む値。actors が無ければ未実行時の見た目になる */
export interface CodeContext {
  /** コードに埋める式。未実行なら `kuramoto.address` のような変数参照になる */
  kuramoto: string;
  han: string;
  nakagai: string;
  /** 生のアドレス。コメントに添えるのに使う。未実行なら null */
  addr: Record<'kuramoto' | 'han' | 'nakagai', string> | null;
  /** 実際のアドレスが入っているか (= ① 実行済みか) */
  live: boolean;
}

const PLACEHOLDER: CodeContext = {
  kuramoto: 'kuramoto.address',
  han: 'han.address',
  nakagai: 'nakagai.address',
  addr: null,
  live: false,
};

export function contextFrom(actors: Actors | null): CodeContext {
  if (!actors) return PLACEHOLDER;
  return {
    kuramoto: `"${actors.kuramoto.wallet.address}"`,
    han: `"${actors.han.wallet.address}"`,
    nakagai: `"${actors.nakagai.wallet.address}"`,
    addr: {
      kuramoto: actors.kuramoto.wallet.address,
      han: actors.han.wallet.address,
      nakagai: actors.nakagai.wallet.address,
    },
    live: true,
  };
}

/**
 * コードの下に出す注記。
 *
 * ステップごとに事情が違う。① は鍵を作る側なので、貼って実行しても
 * 同じ口座にはならない (別の鍵が生まれる)。② 以降は実際のアドレスが
 * 埋まっているので、貼れば同じ口座に対して同じことが起きる。
 * ここを一律にすると嘘になる。
 */
export function noteFor(step: StepId, ctx: CodeContext): string | null {
  if (step === 'wallets') {
    return ctx.live
      ? '生成された 3 つのアドレスをコメントに添えてある。貼って実行すれば、また別の鍵が作られる。'
      : '① を実行すると、生成されたアドレスがコメントに入る。';
  }
  return ctx.live
    ? '① で実際に作られた口座のアドレスが入っている。このまま Node.js に貼れば、同じ口座に対して同じことが起きる。'
    : '① を実行すると、ここが実際に生成されたアドレスに置き換わる。';
}

/** 台帳につなぐところ。どのステップより前に一度だけ要る */
export const CONNECT_SNIPPET = `const xrpl = require("xrpl");
const client = new xrpl.Client("${TESTNET_WS}");
await client.connect();`;

export function codeFor(step: StepId, ctx: CodeContext): string {
  switch (step) {
    case 'wallets': {
      // 実行後はどの鍵がどのアドレスになったかを添える。
      // ここだけはアドレスをコードに埋め込めない (これから作る側なので)
      const a = ctx.addr;
      return `// 鍵はこのブラウザの中だけで生成される。外には出ない。
const kuramoto = xrpl.Wallet.generate();   // 蔵元 — ${a ? a.kuramoto : '既定は ed25519'}
const han      = xrpl.Wallet.generate();   // 藩 — ${a ? a.han : 'ed25519'}
const nakagai  = xrpl.Wallet.generate();   // 米仲買 — ${a ? a.nakagai : 'ed25519'}

// faucet に渡すのはアドレスだけ。口座はここで初めて台帳の上に存在する。
for (const w of [kuramoto, han, nakagai]) {
  await client.fundWallet(w);
}`;
    }

    case 'issuer':
      return `// これが無いと保有者どうしの送金が tecPATH_DRY で落ちる。
// (板の約定は通ってしまうので、漏れに気づきにくい)
await client.submitAndWait({
  TransactionType: "AccountSet",
  Account: ${ctx.kuramoto},
  SetFlag: xrpl.AccountSetAsfFlags.asfDefaultRipple,
}, { autofill: true, wallet: kuramoto });`;

    case 'trust':
      return `// 受け取る側が出す。発行体が勝手に引くことはできない。
for (const holder of [han, nakagai]) {
  await client.submitAndWait({
    TransactionType: "TrustSet",
    Account: holder.address,
    LimitAmount: {
      currency: "${CURRENCY}",
      issuer: ${ctx.kuramoto},
      value: "${TRUST_LIMIT}",
    },
  }, { autofill: true, wallet: holder });
}`;

    case 'issue':
      return `// 発行体が自分のトークンを送ると、それが「発行」になる。
// 新しい取引種別は要らない。負債が生まれる瞬間が、ただの送金として書かれる。
await client.submitAndWait({
  TransactionType: "Payment",
  Account: ${ctx.kuramoto},
  Destination: ${ctx.han},
  DeliverMax: {
    currency: "${CURRENCY}",
    issuer: ${ctx.kuramoto},
    value: "${ISSUE_AMOUNT}",
  },
}, { autofill: true, wallet: kuramoto });`;

    case 'offer':
      return `// TakerGets = 自分が売るもの。主語は「板から取る相手」であることに注意。
await client.submitAndWait({
  TransactionType: "OfferCreate",
  Account: ${ctx.han},
  TakerGets: {
    currency: "${CURRENCY}",
    issuer: ${ctx.kuramoto},
    value: "${OFFER_AMOUNT}",
  },
  TakerPays: xrpl.xrpToDrops("${OFFER_PRICE_XRP}"),
}, { autofill: true, wallet: han });`;

    case 'settle':
      return `// ⑤ と鏡像の注文を出す。その場で交差して約定する。
// 板を全部は食わないので、藩の注文は ${Number(OFFER_AMOUNT) - Number(TAKE_AMOUNT)} 石ぶんが残る。
await client.submitAndWait({
  TransactionType: "OfferCreate",
  Account: ${ctx.nakagai},
  TakerGets: xrpl.xrpToDrops("${TAKE_PRICE_XRP}"),
  TakerPays: {
    currency: "${CURRENCY}",
    issuer: ${ctx.kuramoto},
    value: "${TAKE_AMOUNT}",
  },
}, { autofill: true, wallet: nakagai });`;
  }
}
