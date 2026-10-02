import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Address, Hex } from 'viem';

/**
 * 提案と署名の保管庫（Cloudflare KV 版）。
 *
 * チェーンは「最終的に揃った署名」しか見ない。
 * 誰がどう署名を集めるかは完全にチェーンの外の問題で、ここがその置き場である。
 * Safe でいう Safe Transaction Service にあたる。
 *
 * Workers にファイルシステムは無いので、ローカル版の JSON ファイルから KV に移した。
 * キーは `p:{contract小文字}:{id}` とし、prefix 付き list で
 * コントラクト単位の一覧を取れるようにしている。
 */

export type Signature = {
  signer: Address;
  signature: Hex;
  addedAt: string;
};

export type Proposal = {
  id: string;
  contract: Address;
  to: Address;
  value: string; // wei
  data: Hex;
  nonce: string; // 作成時点の nonce
  txHash: Hex;
  createdAt: string;
  signatures: Signature[];
};

function kv(): KVNamespace {
  // 型は `npm run cf-typegen` が wrangler.jsonc から生成する
  const { env } = getCloudflareContext();
  if (!env?.PROPOSALS) {
    throw new Error('KV binding PROPOSALS が見つかりません（wrangler.jsonc を確認）');
  }
  return env.PROPOSALS;
}

const keyOf = (contract: string, id: string) => `p:${contract.toLowerCase()}:${id}`;

export async function listProposals(contract: Address): Promise<Proposal[]> {
  const store = kv();
  const { keys } = await store.list({ prefix: `p:${contract.toLowerCase()}:`, limit: 200 });
  const items = await Promise.all(keys.map((k) => store.get<Proposal>(k.name, 'json')));
  return items
    .filter((x): x is Proposal => x !== null)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getProposal(contract: Address, id: string): Promise<Proposal | null> {
  return kv().get<Proposal>(keyOf(contract, id), 'json');
}

export async function putProposal(p: Proposal): Promise<Proposal> {
  await kv().put(keyOf(p.contract, p.id), JSON.stringify(p));
  return p;
}
