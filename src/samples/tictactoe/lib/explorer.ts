import type { Chain } from 'viem';

import { SUPPORTED_CHAINS } from '@/samples/tictactoe/lib/chains';

function chainOf(chainId: number | undefined): Chain | undefined {
  return SUPPORTED_CHAINS.find((chain) => chain.id === chainId);
}

/**
 * A local Anvil node has no block explorer, so these return undefined there and
 * the UI falls back to showing the raw hash. Every public testnet has one.
 */
export function explorerName(chainId: number | undefined): string | undefined {
  return chainOf(chainId)?.blockExplorers?.default.name;
}

export function txUrl(chainId: number | undefined, hash: string): string | undefined {
  const base = chainOf(chainId)?.blockExplorers?.default.url;
  return base ? `${base}/tx/${hash}` : undefined;
}

export function addressUrl(chainId: number | undefined, address: string): string | undefined {
  const base = chainOf(chainId)?.blockExplorers?.default.url;
  return base ? `${base}/address/${address}` : undefined;
}

/**
 * Where to start scanning for a contract's events.
 *
 * Anvil is short-lived, so scanning from genesis costs nothing. Public RPC
 * endpoints usually cap the block range of a single `eth_getLogs`, so set
 * NEXT_PUBLIC_DEPLOY_BLOCK_<chainId> to the deployment block once you deploy.
 */
export function eventsFromBlock(chainId: number | undefined): bigint {
  if (chainId === undefined) return 0n;

  const configured: Record<number, string | undefined> = {
    84532: process.env.NEXT_PUBLIC_DEPLOY_BLOCK_84532,
    11155111: process.env.NEXT_PUBLIC_DEPLOY_BLOCK_11155111,
  };

  const raw = configured[chainId];
  return raw && /^\d+$/.test(raw) ? BigInt(raw) : 0n;
}
