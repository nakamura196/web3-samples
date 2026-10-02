import type { Address } from 'viem';
import { readState, json, bad } from '@/samples/minisig/lib/chain';

/** GET /api/minisig/{address} — コントラクトの現在の状態 */
export async function GET(_req: Request, ctx: { params: Promise<{ address: string }> }) {
  const { address } = await ctx.params;
  try {
    const s = await readState(address as Address);
    return json({
      contract: address,
      chainId: 84532,
      owners: s.owners,
      threshold: Number(s.threshold),
      nonce: Number(s.nonce),
      balanceWei: s.balance.toString(),
    });
  } catch (e) {
    const err = e as Error & { shortMessage?: string; details?: string; cause?: Error };
    return bad(
      [
        '読み取りに失敗',
        err.shortMessage ?? err.message?.split('\n')[0],
        err.details,
        err.cause?.message?.split('\n')[0],
      ]
        .filter(Boolean)
        .join(' / '),
      502
    );
  }
}
