/**
 * 「米切手」シナリオ — 大坂・堂島の蔵屋敷を XRPL に載せ直す。
 *
 * 江戸時代、諸藩は大坂に蔵屋敷を置き、国元から運ばせた年貢米をそこに納めた。
 * 蔵元 (蔵屋敷で出納を扱う商人) は「米○石を確かに預かった」という米切手を発行する。
 * 藩はその切手を売って現金を得た。切手を買った米仲買は、蔵屋敷に持ち込めば
 * いつでも米と引き換えられる。
 *
 * 切手は米そのものではなく、蔵屋敷の負債だった。だから「どの蔵屋敷が出した切手か」で
 * 値が違った。そして切手は堂島の米会所で売買され、世界で最初の組織的な
 * 先物市場になった (1730年に幕府公認)。
 *
 * XRPL の issued currency (IOU) は、この構造をほぼそのまま持っている:
 *   - 発行体は資産の一部 (「A 藩の蔵屋敷の 100 石」≠「B 藩の蔵屋敷の 100 石」)
 *   - 保有には受け手の同意が要る (trust line)
 *   - 発行された瞬間から、板で売買できる
 *
 * このモジュールは、その 6 ステップを Testnet 上で実際に走らせる。
 * React に依存していないので、ブラウザでも `npm run verify` でも同じコードが動く。
 */

import {
  AccountSetAsfFlags,
  Client,
  Wallet,
  xrpToDrops,
  type AccountSet,
  type OfferCreate,
  type Payment,
  type SubmittableTransaction,
  type TrustSet,
} from 'xrpl';
import { CURRENCY, UNIT_LABEL } from './ledger.ts';

export type ActorRole = 'kuramoto' | 'han' | 'nakagai';

export interface Actor {
  role: ActorRole;
  /** 現代の役割 */
  name: string;
  /** 江戸時代の対応する役割 */
  historical: string;
  wallet: Wallet;
}

export type Actors = Record<ActorRole, Actor>;

/** 検証済みトランザクション 1 件 = 「切手」1 枚 */
export interface Receipt {
  stepId: string;
  /** TransactionType */
  type: string;
  /** 人間向けの一行説明 */
  summary: string;
  account: string;
  destination?: string;
  amount?: string;
  hash: string;
  ledgerIndex: number;
  /** tesSUCCESS など */
  result: string;
  feeDrops: number;
}

/** 発行する切手の総量 (= 米 100 石) */
export const ISSUE_AMOUNT = '100';
/** 藩が板に出す量 */
export const OFFER_AMOUNT = '40';
/** その対価 (XRP) */
export const OFFER_PRICE_XRP = '8';
/** 米仲買が買い取る量 (板を全部は食わない) */
export const TAKE_AMOUNT = '25';
/** その対価。単価は藩の売り注文と同じ 0.2 XRP / 石。 */
export const TAKE_PRICE_XRP = '5';
/** 保有者が受け入れる発行体リスクの上限 */
export const TRUST_LIMIT = '1000';

// ── トランザクション送信 ───────────────────────────────────────────

/**
 * 署名して投げ、検証済みレジャーに載るまで待つ。
 *
 * submitAndWait が返るということは、そのレジャーが 80% 超の合意で
 * クローズしたということ。確認待ちの「6 ブロック」のような概念はなく、
 * tesSUCCESS はその時点で最終 (deterministic finality)。
 */
async function submit(
  client: Client,
  wallet: Wallet,
  tx: SubmittableTransaction,
  stepId: string,
  summary: string,
): Promise<Receipt> {
  const res = await client.submitAndWait(tx, { autofill: true, wallet });
  const r = res.result as unknown as {
    hash: string;
    ledger_index?: number;
    tx_json?: { Fee?: string; TransactionType?: string };
    Fee?: string;
    TransactionType?: string;
  };
  const meta = typeof res.result.meta === 'object' ? res.result.meta : undefined;
  const result =
    (meta && 'TransactionResult' in meta ? meta.TransactionResult : undefined) ?? 'unknown';

  if (result !== 'tesSUCCESS') {
    // tec 系は手数料を消費して台帳に載る「失敗の記録」、tem 系はそもそも不正形。
    throw new Error(`${summary}: ${result}`);
  }

  return {
    stepId,
    type: r.tx_json?.TransactionType ?? r.TransactionType ?? tx.TransactionType,
    summary,
    account: tx.Account,
    destination: 'Destination' in tx ? (tx.Destination as string) : undefined,
    amount: undefined,
    hash: r.hash,
    ledgerIndex: r.ledger_index ?? 0,
    result,
    feeDrops: Number(r.tx_json?.Fee ?? r.Fee ?? 0),
  };
}

// ── ステップ ────────────────────────────────────────────────────

/**
 * ① 三者分の鍵をブラウザで作り、faucet で資金を入れる。
 *
 * 鍵はここで生成され、外に出ない。faucet に渡すのはアドレスだけ。
 * XRPL の口座は「1 XRP の base reserve が入って初めて存在する」ので、
 * 資金投入は口座を開くことそのものでもある。
 */
export async function createActors(
  client: Client,
  onProgress: (msg: string) => void,
): Promise<Actors> {
  const spec: Array<{ role: ActorRole; name: string; historical: string }> = [
    {
      role: 'kuramoto',
      name: '蔵元 (発行体)',
      historical: '大坂の蔵屋敷で年貢米を預かり、米切手を発行する商人',
    },
    {
      role: 'han',
      name: '藩 (預けた側)',
      historical: '国元から米を送り、受け取った切手を売って現金にする',
    },
    {
      role: 'nakagai',
      name: '米仲買 (買い手)',
      historical: '堂島の米会所で切手を売買し、蔵屋敷で米と引き換える',
    },
  ];

  const actors = {} as Actors;
  for (const s of spec) {
    const wallet = Wallet.generate(); // 既定は ed25519
    onProgress(`${s.name} の鍵を生成: ${wallet.address}`);
    await client.fundWallet(wallet);
    onProgress(`${s.name} に faucet から入金`);
    actors[s.role] = { ...s, wallet };
  }
  return actors;
}

/**
 * ② 蔵元を「発行体」として設定する (AccountSet / DefaultRipple)。
 *
 * DefaultRipple が無効だと、発行体を経由した保有者どうしの直接送金
 * (= 藩 → 米仲買 の Payment) が tecPATH_DRY で落ちる。「発行体になる」という意思表示。
 *
 * 注意: 板の約定 (OfferCreate による cross) は rippling を通らないので、
 * このフラグが無くても成功する。Testnet で実測して確かめた
 * (scripts/no-default-ripple.ts)。つまりこの 6 ステップは ② を飛ばしても
 * 完走してしまう。壊れるのは保有者どうしが送金しようとしたときで、
 * 発行したトークンを実用にするなら事実上必須である。
 */
export async function enableIssuance(client: Client, actors: Actors): Promise<Receipt> {
  const tx: AccountSet = {
    TransactionType: 'AccountSet',
    Account: actors.kuramoto.wallet.address,
    SetFlag: AccountSetAsfFlags.asfDefaultRipple,
  };
  return submit(
    client,
    actors.kuramoto.wallet,
    tx,
    'issuer',
    '蔵元を発行体として設定 (DefaultRipple)',
  );
}

/**
 * ③ 信用線を引く (TrustSet)。
 *
 * 「同意なくして残高なし」。trust line が無い口座に IOU を送っても、
 * エラーとして跳ね返るのではなく、そもそも取引が成立しない。
 * limit は「この蔵屋敷のリスクをいくらまで引き受けるか」の自己申告で、
 * 与信管理がアプリ層ではなくプロトコル層に置かれている。
 */
export async function openTrustLines(client: Client, actors: Actors): Promise<Receipt[]> {
  const issuer = actors.kuramoto.wallet.address;
  const out: Receipt[] = [];
  for (const role of ['han', 'nakagai'] as const) {
    const actor = actors[role];
    const tx: TrustSet = {
      TransactionType: 'TrustSet',
      Account: actor.wallet.address,
      LimitAmount: { currency: CURRENCY, issuer, value: TRUST_LIMIT },
    };
    out.push(
      await submit(
        client,
        actor.wallet,
        tx,
        'trust',
        `${actor.name} がこの蔵屋敷の切手を最大 ${TRUST_LIMIT} ${UNIT_LABEL}まで受け入れる`,
      ),
    );
  }
  return out;
}

/**
 * ④ 米切手を発行する (Payment)。
 *
 * 発行体から送られた IOU は、その瞬間に発行体の負債として台帳に載る。
 * 蔵元が印判を押して藩に切手を渡す動作に対応する。
 */
export async function issueNote(client: Client, actors: Actors): Promise<Receipt> {
  const issuer = actors.kuramoto.wallet.address;
  const tx: Payment = {
    TransactionType: 'Payment',
    Account: issuer,
    Destination: actors.han.wallet.address,
    // 講義スライドの DeliverMax は Amount の新しい名前。型定義上は Amount を使う。
    Amount: { currency: CURRENCY, issuer, value: ISSUE_AMOUNT },
  };
  const r = await submit(
    client,
    actors.kuramoto.wallet,
    tx,
    'issue',
    `蔵元が藩へ米 ${ISSUE_AMOUNT} ${UNIT_LABEL}ぶんの切手を発行`,
  );
  return { ...r, amount: `${ISSUE_AMOUNT} ${UNIT_LABEL} (${CURRENCY})` };
}

/**
 * ⑤ 切手を板に出す (OfferCreate)。
 *
 * 堂島の米会所にあたる。コントラクトのデプロイも gas 見積もりも監査予算も要らない。
 * オーダーブックは 2012 年からプロトコルの一次機能。
 */
export async function listOnDex(client: Client, actors: Actors): Promise<Receipt> {
  const issuer = actors.kuramoto.wallet.address;
  const tx: OfferCreate = {
    TransactionType: 'OfferCreate',
    Account: actors.han.wallet.address,
    TakerGets: { currency: CURRENCY, issuer, value: OFFER_AMOUNT },
    TakerPays: xrpToDrops(OFFER_PRICE_XRP),
  };
  const r = await submit(
    client,
    actors.han.wallet,
    tx,
    'offer',
    `藩が ${OFFER_AMOUNT} ${UNIT_LABEL}ぶんを ${OFFER_PRICE_XRP} XRP で売り注文`,
  );
  return { ...r, amount: `${OFFER_AMOUNT} ${UNIT_LABEL} ⇄ ${OFFER_PRICE_XRP} XRP` };
}

/**
 * ⑥ 米仲買が板を食う (部分約定)。
 *
 * 反対側の注文を出すと、その場で交差して約定する。
 * 「XRP を渡す」と「切手を受け取る」は同一トランザクションで、
 * 片方だけ起きることはない (原子性)。
 *
 * ここではわざと板を全部は食わない。単価が同じなので米仲買の注文は
 * 使い切られて消え、藩の注文は残り (40−25 = 15 石) が板に残る。
 */
export async function takeOffer(client: Client, actors: Actors): Promise<Receipt> {
  const issuer = actors.kuramoto.wallet.address;
  const tx: OfferCreate = {
    TransactionType: 'OfferCreate',
    Account: actors.nakagai.wallet.address,
    TakerGets: xrpToDrops(TAKE_PRICE_XRP),
    TakerPays: { currency: CURRENCY, issuer, value: TAKE_AMOUNT },
  };
  const r = await submit(
    client,
    actors.nakagai.wallet,
    tx,
    'settle',
    `米仲買が ${TAKE_PRICE_XRP} XRP を払って ${TAKE_AMOUNT} ${UNIT_LABEL}ぶんを取得`,
  );
  return { ...r, amount: `${TAKE_PRICE_XRP} XRP → ${TAKE_AMOUNT} ${UNIT_LABEL}` };
}
