/**
 * XRPL Testnet への接続と読み取り。
 *
 * このアプリはサーバを持たない。ブラウザから直接 `wss://s.altnet.rippletest.net:51233`
 * に WebSocket でつなぐ。鍵はブラウザのメモリ上だけに存在し、どこにも送らない。
 * (Testnet 専用。ここで作った鍵に実資産を入れないこと)
 */

import { Client, Wallet, dropsToXrp } from 'xrpl';

export const TESTNET_WS = 'wss://s.altnet.rippletest.net:51233';
export const EXPLORER = 'https://testnet.xrpl.org';

/** 米切手トークンの通貨コード。XRPL の標準通貨コードは ASCII 3 文字。 */
export const CURRENCY = 'KOK';

/** 1 KOK = 米 1 石 (こく)。江戸時代の米の計量単位で、およそ 150 kg。 */
export const UNIT_LABEL = '石';

export function explorerTx(hash: string): string {
  return `${EXPLORER}/transactions/${hash}`;
}

export function explorerAccount(address: string): string {
  return `${EXPLORER}/accounts/${address}`;
}

let shared: Client | null = null;

/** 接続済みクライアントを 1 本だけ共有する */
export async function getClient(): Promise<Client> {
  if (shared?.isConnected()) return shared;
  const client = new Client(TESTNET_WS, { connectionTimeout: 15_000 });
  await client.connect();
  shared = client;
  return client;
}

export async function disconnect(): Promise<void> {
  if (shared?.isConnected()) await shared.disconnect();
  shared = null;
}

/** XRP 残高 (準備金を含む口座残高) */
export async function xrpBalance(client: Client, address: string): Promise<string> {
  try {
    const res = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated',
    });
    return dropsToXrp(res.result.account_data.Balance).toString();
  } catch {
    // 未 fund の口座は actNotFound になる。0 として扱う。
    return '0';
  }
}

export interface TrustLine {
  currency: string;
  issuer: string;
  balance: string;
  limit: string;
}

/**
 * 発行済みトークン (IOU) の残高。
 *
 * XRP と違い IOU は「どの蔵屋敷の負債か」まで含めて 1 つの資産なので、
 * account_lines は必ず issuer とセットで返ってくる。
 */
export async function trustLines(client: Client, address: string): Promise<TrustLine[]> {
  try {
    const res = await client.request({
      command: 'account_lines',
      account: address,
      ledger_index: 'validated',
    });
    return res.result.lines.map((l) => ({
      currency: l.currency,
      issuer: l.account,
      balance: l.balance,
      limit: l.limit,
    }));
  } catch {
    return [];
  }
}

/** 口座が持つオブジェクト数 = owner reserve の対象数 (trust line / offer など) */
export async function ownerCount(client: Client, address: string): Promise<number> {
  try {
    const res = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated',
    });
    return res.result.account_data.OwnerCount ?? 0;
  } catch {
    return 0;
  }
}

export interface BookRow {
  /** 売り手 */
  account: string;
  /** 売る側の数量 (GRN) */
  getsValue: string;
  /** 対価 (XRP) */
  paysXrp: string;
  /** 1 GRN あたりの XRP */
  price: string;
}

/**
 * ネイティブ DEX の板を読む。
 *
 * 「コントラクトを読む」のではない。オーダーブックは 2012 年から
 * プロトコルの一次機能で、rippled に直接問い合わせるだけで見える。
 */
export async function orderBook(
  client: Client,
  issuer: string,
): Promise<BookRow[]> {
  const res = await client.request({
    command: 'book_offers',
    taker_gets: { currency: CURRENCY, issuer },
    taker_pays: { currency: 'XRP' },
    limit: 20,
    ledger_index: 'validated',
  });
  return res.result.offers.map((o) => {
    const gets = typeof o.TakerGets === 'string' ? o.TakerGets : o.TakerGets.value;
    const paysDrops = typeof o.TakerPays === 'string' ? o.TakerPays : o.TakerPays.value;
    const paysXrp = dropsToXrp(paysDrops).toString();
    const price = Number(gets) === 0 ? '0' : (Number(paysXrp) / Number(gets)).toFixed(6);
    return { account: o.Account, getsValue: gets, paysXrp, price };
  });
}

export interface Route {
  /** 支払い側が出す通貨と数量 */
  sourceAmount: string;
  /** 経由する板の並び。空配列 = 直接 (信用線をそのまま伝う) */
  hops: string[];
}

/**
 * 経路探索 (ripple_path_find)。
 *
 * 「この相手にこの資産をこれだけ届けたい。何を出せば届くか」をレジャー自身に聞く。
 * 送金者が直接は持っていない通貨を経由する経路も返ってくる。
 * 見つかった経路を Payment の Paths に載せれば、複数ホップが 1 つの
 * トランザクションとして原子的に決済される。
 */
export async function findRoutes(
  client: Client,
  source: string,
  destination: string,
  destinationAmount: { currency: string; issuer: string; value: string },
): Promise<Route[]> {
  const res = await client.request({
    command: 'ripple_path_find',
    source_account: source,
    destination_account: destination,
    destination_amount: destinationAmount,
  });
  return res.result.alternatives.map((alt) => {
    const src = alt.source_amount;
    const sourceAmount =
      typeof src === 'string'
        ? `${dropsToXrp(src)} XRP`
        : 'currency' in src
          ? `${src.value} ${src.currency}`
          : String(src);
    const hops = (alt.paths_computed ?? []).flatMap((path) =>
      path.map((step) => {
        if (step.currency) return step.currency === 'XRP' ? 'XRP' : `${step.currency} の板`;
        if (step.account) return `${step.account.slice(0, 6)}… を経由`;
        return '?';
      }),
    );
    return { sourceAmount, hops };
  });
}

/** Testnet faucet から資金を入れる。鍵はこちらで作り、アドレスだけ渡す。 */
export async function fund(client: Client, wallet: Wallet): Promise<void> {
  await client.fundWallet(wallet);
}

export interface Snapshot {
  xrp: string;
  /** 米切手の残高 (発行体自身は負の値 = 負債) */
  grn: string;
  /** 予約金の対象になっているオブジェクト数 */
  owners: number;
}

/** 1 口座ぶんの表示用スナップショット */
export async function snapshot(client: Client, address: string): Promise<Snapshot> {
  const [xrp, lines, owners] = await Promise.all([
    xrpBalance(client, address),
    trustLines(client, address),
    ownerCount(client, address),
  ]);
  const grn = lines
    .filter((l) => l.currency === CURRENCY)
    .reduce((sum, l) => sum + Number(l.balance), 0);
  return { xrp, grn: String(grn), owners };
}

/** 予約金の内訳。2024/12 の fee voting で base 10→1 XRP, owner 2→0.2 XRP に下がった。 */
export const BASE_RESERVE_XRP = 1;
export const OWNER_RESERVE_XRP = 0.2;
