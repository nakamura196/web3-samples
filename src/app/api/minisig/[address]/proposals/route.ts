import type { Address, Hex } from 'viem';
import { isAddress } from 'viem';
import { readState, fetchTxHash, json, bad } from '@/samples/minisig/lib/chain';
import { listProposals, putProposal, type Proposal } from '@/samples/minisig/lib/store';

/** GET /api/minisig/{address}/proposals — 提案の一覧 */
export async function GET(_req: Request, ctx: { params: Promise<{ address: string }> }) {
  const { address } = await ctx.params;
  if (!isAddress(address)) return bad('コントラクトのアドレスが不正');

  const s = await readState(address as Address);
  const list = await listProposals(address as Address);
  return json({
    contract: address,
    nonce: Number(s.nonce),
    threshold: Number(s.threshold),
    proposals: list.map((p) => ({
      ...p,
      ready: p.signatures.length >= Number(s.threshold) && p.nonce === s.nonce.toString(),
      stale: p.nonce !== s.nonce.toString(),
    })),
  });
}

/**
 * POST /api/minisig/{address}/proposals
 * body: { to, value (wei 文字列), data? }
 *
 * txHash はクライアントから受け取らない。必ずコントラクトに計算させる。
 */
export async function POST(req: Request, ctx: { params: Promise<{ address: string }> }) {
  const { address } = await ctx.params;
  if (!isAddress(address)) return bad('コントラクトのアドレスが不正');

  let body: { to?: string; value?: string; data?: string };
  try {
    body = await req.json();
  } catch {
    return bad('JSON として読めない');
  }

  const { to, value = '0', data = '0x' } = body;
  if (!to || !isAddress(to)) return bad('to が不正');
  let valueWei: bigint;
  try {
    valueWei = BigInt(value);
  } catch {
    return bad('value は wei の10進文字列で指定する');
  }
  if (!/^0x([0-9a-fA-F]{2})*$/.test(data)) return bad('data が16進として不正');

  const s = await readState(address as Address);
  const txHash = await fetchTxHash(address as Address, to as Address, valueWei, data as Hex, s.nonce);

  const p: Proposal = {
    id: crypto.randomUUID(),
    contract: address as Address,
    to: to as Address,
    value: valueWei.toString(),
    data: data as Hex,
    nonce: s.nonce.toString(),
    txHash,
    createdAt: new Date().toISOString(),
    signatures: [],
  };
  await putProposal(p);

  return json(
    { ...p, threshold: Number(s.threshold), signHint: `cast wallet sign --private-key <PK> ${txHash}` },
    201
  );
}
