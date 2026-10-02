import type { Address } from 'viem';
import { readState, json, bad } from '@/samples/minisig/lib/chain';
import { getProposal } from '@/samples/minisig/lib/store';

/** GET /api/minisig/{address}/proposals/{id} */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ address: string; id: string }> }
) {
  const { address, id } = await ctx.params;
  const p = await getProposal(address as Address, id);
  if (!p) return bad('提案が見つからない', 404);

  const s = await readState(address as Address);
  const stale = p.nonce !== s.nonce.toString();
  return json({
    ...p,
    threshold: Number(s.threshold),
    collected: p.signatures.length,
    ready: !stale && p.signatures.length >= Number(s.threshold),
    stale,
    staleReason: stale
      ? `作成時の nonce=${p.nonce} に対し、現在は ${s.nonce}。署名は無効なので作り直す`
      : undefined,
  });
}
