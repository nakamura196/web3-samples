import { encodeFunctionData, type Address } from 'viem';
import { MINISIG_ABI, concatSortedSignatures } from '@/samples/minisig/lib/minisig';
import { readState, json, bad } from '@/samples/minisig/lib/chain';
import { getProposal } from '@/samples/minisig/lib/store';

/**
 * GET /api/minisig/{address}/proposals/{id}/calldata
 *
 * 署名が揃っていれば、そのまま送信できる calldata を返す。
 * **送信はしない。** ガスを払う鍵はサーバに無い。
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ address: string; id: string }> }
) {
  const { address, id } = await ctx.params;

  const p = await getProposal(address as Address, id);
  if (!p) return bad('提案が見つからない', 404);

  const s = await readState(address as Address);
  if (p.nonce !== s.nonce.toString()) {
    return bad(`この提案は古い（作成時 nonce=${p.nonce}、現在 ${s.nonce}）`, 409);
  }
  if (p.signatures.length < Number(s.threshold)) {
    return bad(`署名が足りない（${p.signatures.length}/${s.threshold}）`, 409);
  }

  const packed = concatSortedSignatures(
    p.signatures.map((x) => ({ signer: x.signer, signature: x.signature }))
  );

  const calldata = encodeFunctionData({
    abi: MINISIG_ABI,
    functionName: 'execTransaction',
    args: [p.to, BigInt(p.value), p.data, packed],
  });

  return json({
    to: p.contract,
    data: calldata,
    value: '0',
    signatures: packed,
    signers: p.signatures.map((x) => x.signer),
    sendHint:
      `cast send ${p.contract} "execTransaction(address,uint256,bytes,bytes)" ` +
      `${p.to} ${p.value} ${p.data} ${packed} --rpc-url https://sepolia.base.org --private-key <PK>`,
  });
}
