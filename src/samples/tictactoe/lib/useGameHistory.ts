'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';

import { soloTicTacToeAbi, ticTacToeAbi } from '@/samples/tictactoe/generated/wagmi';
import { eventsFromBlock } from '@/samples/tictactoe/lib/explorer';

export type HistoryEntry = {
  kind: 'pvp' | 'solo';
  gameId: bigint;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  /** How the viewer took part. */
  role: 'created' | 'joined' | 'played';
};

/**
 * Every game the address has touched, found through the events' indexed topics.
 *
 * The node does the filtering: `args: { playerX: address }` becomes a topic
 * filter, so we never download games belonging to other players. That works
 * because the contract marked those parameters `indexed` — a decision that
 * cannot be changed after deployment, and the reason a read like this needs no
 * subgraph.
 */
export function useGameHistory(
  address: `0x${string}` | undefined,
  pvp: `0x${string}` | undefined,
  solo: `0x${string}` | undefined,
  chainId: number | undefined
) {
  const client = usePublicClient();

  return useQuery({
    queryKey: ['game-history', chainId, address, pvp, solo],
    enabled: !!client && !!address,
    refetchInterval: 10_000,
    queryFn: async (): Promise<HistoryEntry[]> => {
      if (!client || !address) return [];
      const fromBlock = eventsFromBlock(chainId);

      // One request per (contract, role). Each is a topic-filtered getLogs, so
      // the work happens on the node rather than in the browser.
      const requests: Promise<HistoryEntry[]>[] = [];

      if (pvp) {
        requests.push(
          client
            .getContractEvents({
              address: pvp,
              abi: ticTacToeAbi,
              eventName: 'GameCreated',
              args: { playerX: address },
              fromBlock,
            })
            .then((logs) => logs.map((log) => toEntry('pvp', 'created', log)))
        );
        requests.push(
          client
            .getContractEvents({
              address: pvp,
              abi: ticTacToeAbi,
              eventName: 'GameJoined',
              args: { playerO: address },
              fromBlock,
            })
            .then((logs) => logs.map((log) => toEntry('pvp', 'joined', log)))
        );
      }

      if (solo) {
        requests.push(
          client
            .getContractEvents({
              address: solo,
              abi: soloTicTacToeAbi,
              eventName: 'GameCreated',
              args: { player: address },
              fromBlock,
            })
            .then((logs) => logs.map((log) => toEntry('solo', 'created', log)))
        );
      }

      const entries = (await Promise.all(requests)).flat();
      // Newest first. Same block: whichever the node listed last.
      return entries.sort((a, b) => Number(b.blockNumber - a.blockNumber));
    },
  });
}

type MinimalLog = {
  args: { gameId?: bigint };
  blockNumber: bigint | null;
  transactionHash: `0x${string}` | null;
};

function toEntry(kind: HistoryEntry['kind'], role: HistoryEntry['role'], log: unknown): HistoryEntry {
  const { args, blockNumber, transactionHash } = log as MinimalLog;
  return {
    kind,
    role,
    gameId: args.gameId ?? 0n,
    blockNumber: blockNumber ?? 0n,
    transactionHash: transactionHash ?? '0x',
  };
}
