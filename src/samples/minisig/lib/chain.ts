import { recoverMessageAddress, type Address, type Hex } from "viem";
import { MINISIG_ABI, publicClient } from "./minisig";

/** チェーンから読める、コントラクトの現在の状態 */
export async function readState(contract: Address) {
  const [owners, threshold, nonce, balance] = await Promise.all([
    publicClient.readContract({ address: contract, abi: MINISIG_ABI, functionName: "owners" }),
    publicClient.readContract({ address: contract, abi: MINISIG_ABI, functionName: "threshold" }),
    publicClient.readContract({ address: contract, abi: MINISIG_ABI, functionName: "nonce" }),
    publicClient.getBalance({ address: contract }),
  ]);
  return { owners, threshold, nonce, balance };
}

/** 署名対象のハッシュ。**必ずコントラクトに計算させる** */
export async function fetchTxHash(
  contract: Address, to: Address, value: bigint, data: Hex, nonce: bigint,
): Promise<Hex> {
  return publicClient.readContract({
    address: contract, abi: MINISIG_ABI, functionName: "txHash",
    args: [to, value, data, nonce],
  });
}

/**
 * 署名から署名者を復元し、所有者かどうかを判定する。
 * クライアントが申告した署名者は信用しない。
 */
export async function recoverOwner(
  txHash: Hex, signature: Hex, owners: readonly Address[],
): Promise<{ ok: true; signer: Address } | { ok: false; signer: Address | null; reason: string }> {
  let signer: Address;
  try {
    signer = await recoverMessageAddress({ message: { raw: txHash }, signature });
  } catch (e) {
    return { ok: false, signer: null, reason: `署名を復元できない: ${(e as Error).message}` };
  }
  const isOwner = owners.some((o) => o.toLowerCase() === signer.toLowerCase());
  return isOwner
    ? { ok: true, signer }
    : { ok: false, signer, reason: "復元された署名者が所有者ではない" };
}

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status });

export const bad = (message: string, status = 400) =>
  Response.json({ error: message }, { status });
