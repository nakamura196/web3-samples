'use client';

import { useQuery } from '@tanstack/react-query';
import type { Abi } from 'viem';
import { usePublicClient } from 'wagmi';

import { eventsFromBlock } from '@/samples/tictactoe/lib/explorer';

export type ChainEvent = {
  eventName: string;
  transactionHash: `0x${string}`;
  args: Record<string, unknown>;
};

export type ChainBlock = {
  number: bigint;
  hash: `0x${string}`;
  parentHash: `0x${string}`;
  timestamp: bigint;
  /** Total transactions in the block, not just this game's. */
  transactionCount: number;
  events: ChainEvent[];
  /** Blocks between this one and the previous shown block, if any. */
  gapBefore: bigint;
  /** True when parentHash equals the previous shown block's hash. */
  linksToPrevious: boolean;
};

/**
 * Everything one game left on the chain, arranged as the blocks that carried it.
 *
 * Each block names its predecessor by hash, so changing an old block would
 * change its hash and break every link after it. Laying the blocks out in order
 * makes that chain visible rather than something to take on faith.
 */
export function useGameChain(
  address: `0x${string}` | undefined,
  abi: Abi,
  gameId: bigint | undefined,
  chainId: number | undefined
) {
  const client = usePublicClient();

  return useQuery({
    queryKey: ['game-chain', chainId, address, gameId?.toString()],
    enabled: !!client && !!address && gameId !== undefined,
    refetchInterval: 8_000,
    queryFn: async (): Promise<ChainBlock[]> => {
      if (!client || !address || gameId === undefined) return [];

      const logs = await client.getContractEvents({
        address,
        abi,
        fromBlock: eventsFromBlock(chainId),
        toBlock: 'latest',
      });

      const mine = logs.filter((log) => (log.args as { gameId?: bigint }).gameId === gameId);
      if (mine.length === 0) return [];

      // Group this game's events by the block that carried them.
      const byBlock = new Map<bigint, ChainEvent[]>();
      for (const log of mine) {
        const number = log.blockNumber ?? 0n;
        const list = byBlock.get(number) ?? [];
        list.push({
          eventName: String(log.eventName),
          transactionHash: (log.transactionHash ?? '0x') as `0x${string}`,
          args: (log.args ?? {}) as Record<string, unknown>,
        });
        byBlock.set(number, list);
      }

      const numbers = [...byBlock.keys()].sort((a, b) => Number(a - b));
      const blocks = await Promise.all(numbers.map((number) => client.getBlock({ blockNumber: number })));

      return blocks.map((block, index) => {
        const previous = index > 0 ? blocks[index - 1] : undefined;
        return {
          number: block.number ?? 0n,
          hash: (block.hash ?? '0x') as `0x${string}`,
          parentHash: block.parentHash,
          timestamp: block.timestamp,
          transactionCount: block.transactions.length,
          events: byBlock.get(block.number ?? 0n) ?? [],
          gapBefore: previous ? (block.number ?? 0n) - (previous.number ?? 0n) - 1n : 0n,
          // Only adjacent blocks link directly. With a gap, the chain still runs
          // through the blocks in between — they just carry other people's work.
          linksToPrevious: previous ? block.parentHash === previous.hash : false,
        };
      });
    },
  });
}
