import type { Address, Hex } from 'viem';
import { readState, recoverOwner, json, bad } from '@/samples/minisig/lib/chain';
import { getProposal, putProposal } from '@/samples/minisig/lib/store';

/**
 * POST /api/minisig/{address}/proposals/{id}/signatures
 * body: { signature: "0x..." }
 *
 * 署名者はクライアントに申告させない。サーバが復元して所有者と照合する。
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ address: string; id: string }> }
) {
  const { address, id } = await ctx.params;

  const p = await getProposal(address as Address, id);
  if (!p) return bad('提案が見つからない', 404);

  let body: { signature?: string };
  try {
    body = await req.json();
  } catch {
    return bad('JSON として読めない');
  }
  const signature = body.signature?.trim();
  if (!signature || !/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    return bad('signature は 0x + 130桁の16進（65バイト）で指定する');
  }

  const s = await readState(address as Address);
  if (p.nonce !== s.nonce.toString()) {
    return bad(`この提案は古い（作成時 nonce=${p.nonce}、現在 ${s.nonce}）。作り直すこと`, 409);
  }

  const r = await recoverOwner(p.txHash, signature as Hex, s.owners);
  if (!r.ok) return bad(`${r.reason}${r.signer ? `: ${r.signer}` : ''}`, 422);

  if (p.signatures.some((x) => x.signer.toLowerCase() === r.signer.toLowerCase())) {
    return bad(`この所有者は既に署名している: ${r.signer}`, 409);
  }

  p.signatures.push({
    signer: r.signer,
    signature: signature as Hex,
    addedAt: new Date().toISOString(),
  });
  await putProposal(p);

  return json(
    {
      signer: r.signer,
      collected: p.signatures.length,
      threshold: Number(s.threshold),
      ready: p.signatures.length >= Number(s.threshold),
    },
    201
  );
}
