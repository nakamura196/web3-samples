/**
 * JSON-RPC。依存パッケージなし。
 * ndl-witness/lib/rpc.mjs から、このアプリで使う分だけを持ってきた。
 * 対価を扱わないので ERC-20 まわり (balanceOf / decimals / 桁揃え) は落としてある。
 * 代わりに eth_getLogs を足した — アンカーは**ログにしか残らない**ので、
 * 読む側はログを時系列で読むことになる。
 */
import {rpcCandidates, maskRpc} from './chains.mjs';

/** 生きている RPC を 1 つ選ぶ */
export async function connect(chain) {
  const errors = [];
  for (const url of rpcCandidates(chain)) {
    try {
      const got = parseInt(await rawCall(url, 'eth_chainId', []), 16);
      if (got !== chain.chainId) throw new Error(`chainId が違う: 期待 ${chain.chainId} / 実際 ${got}`);
      return {url, chain, call: (m, p) => rawCall(url, m, p)};
    } catch (e) {
      errors.push(`${maskRpc(url)} → ${e.message}`);
    }
  }
  throw new Error(`使える RPC がない:\n  ${errors.join('\n  ')}`);
}

/**
 * anvil は接続を使い回すと途中で閉じてくることがあるので、毎回閉じる指定にして
 * 通信レベルの失敗だけ数回やり直す。RPC が返したエラーは再試行しない。
 */
async function rawCall(url, method, params, {retries = 3} = {}) {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Connection: 'close'},
        body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (body.error) throw new Error(body.error.message ?? JSON.stringify(body.error));
      return body.result;
    } catch (e) {
      if (!/fetch failed|socket|closed|ECONN|timeout|terminated/i.test(e.message)) throw e;
      lastError = e;
      await new Promise((r) => setTimeout(r, 150 * (i + 1)));
    }
  }
  throw lastError;
}

export const ethCall = (conn, to, data) => conn.call('eth_call', [{to, data}, 'latest']);

export const sendTx = (conn, {from, to, data, value = '0x0'}) =>
  conn.call('eth_sendTransaction', [{from, to, data, value}]);

export async function waitReceipt(conn, txHash, {tries = 60, intervalMs = 250} = {}) {
  for (let i = 0; i < tries; i++) {
    const r = await conn.call('eth_getTransactionReceipt', [txHash]);
    if (r) {
      if (BigInt(r.status) !== 1n) throw new Error(`トランザクションが失敗した: ${txHash}`);
      return r;
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error(`receipt が返らない: ${txHash}`);
}

/** アンカーの記録はログにしか残らないので、読む側はこれで拾う */
export const getLogs = (conn, {address, topics, fromBlock = '0x0', toBlock = 'latest'}) =>
  conn.call('eth_getLogs', [{address, topics, fromBlock, toBlock}]);

export const gasUsed = (receipt) => Number(BigInt(receipt.gasUsed));

// ── ここから下は公開チェーン用。鍵を手元で持つ場合の経路 ──────────────
/**
 * 上の sendTx() は `eth_sendTransaction` を呼ぶ。**ノードが鍵を持っている前提**の
 * 窓口で、anvil にしか無い。公開チェーンでは下の sendSigned() を使う。
 *
 * 違いは「誰が署名するか」だけで、送った後の待ち方 (waitReceipt) は共通。
 */
import {signTransaction, addressOf, feesFrom} from './tx.mjs';

export const nonceOf = async (conn, address) =>
  BigInt(await conn.call('eth_getTransactionCount', [address, 'pending']));

export const balanceOf = async (conn, address) =>
  BigInt(await conn.call('eth_getBalance', [address, 'latest']));

/** 直近のブロックの基本手数料。手数料の上限を決めるのに使う */
export async function baseFee(conn) {
  const block = await conn.call('eth_getBlockByNumber', ['latest', false]);
  return BigInt(block.baseFeePerGas ?? '0x0');
}

/**
 * JSON-RPC は BigInt を運べない (JSON に BigInt が無い)。数は 0x の文字列にする。
 * 署名の側は BigInt で扱うので、**境界がここになる**。
 */
export const qty = (v) => (typeof v === 'bigint' || typeof v === 'number'
  ? '0x' + BigInt(v).toString(16) : v);

export const estimateGas = async (conn, {from, to, data, value = 0n}) =>
  BigInt(await conn.call('eth_estimateGas',
    [{from, ...(to ? {to} : {}), ...(data && data !== '0x' ? {data} : {}), value: qty(value)}]));

/**
 * 手元で署名して送る。nonce・手数料・ガス上限は埋めていなければ問い合わせる。
 *
 * ガス上限に 25% 足しているのは、eth_estimateGas が「いまの状態」で測った値で、
 * 取り込まれる頃には状態が変わっていることがあるため。足りないと
 * **失敗した分のガスだけ取られて** revert する。
 */
export async function sendSigned(conn, tx, priv, {gasBuffer = 125n} = {}) {
  const from = addressOf(priv);
  const chainId = BigInt(conn.chain.chainId);
  const nonce = tx.nonce ?? await nonceOf(conn, from);
  const fees = tx.maxFeePerGas
    ? {maxFeePerGas: BigInt(tx.maxFeePerGas), maxPriorityFeePerGas: BigInt(tx.maxPriorityFeePerGas)}
    : feesFrom(await baseFee(conn));
  const gas = tx.gas ?? (await estimateGas(conn,
    {from, to: tx.to, data: tx.data, value: tx.value ?? 0n})) * gasBuffer / 100n;

  const signed = signTransaction({...tx, chainId, nonce, gas, ...fees}, priv);
  const hash = await conn.call('eth_sendRawTransaction', [signed.raw]);
  if (hash.toLowerCase() !== signed.hash.toLowerCase()) {
    // ノードが返すハッシュは自分で計算したものと必ず一致する。しなければ
    // 送った中身と受け取られた中身が違うということなので、そこで止める
    throw new Error(`txHash が食い違う: 自分 ${signed.hash} / ノード ${hash}`);
  }
  return {...signed, nonce, gas, ...fees};
}

/** 手数料の実額。receipt が出てから「いくら払ったか」を出す */
export const feePaid = (receipt) =>
  BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice ?? '0x0');

export const formatEth = (wei, digits = 6) => {
  const s = (Number(wei) / 1e18).toFixed(digits);
  return `${s} ETH`;
};
