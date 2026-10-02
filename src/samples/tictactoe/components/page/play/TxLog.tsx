'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import type { Abi } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';

import { eventsFromBlock, explorerName, txUrl } from '@/samples/tictactoe/lib/explorer';
import { shortAddress } from '@/samples/tictactoe/lib/game';

type Row = {
  eventName: string;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  args: Record<string, unknown>;
};

/**
 * The contract's own audit trail. Every state change emitted an event, and those
 * events are permanent — so this list is not a log the app keeps, it is the chain
 * telling you what happened. Handy for players, and the fastest debugging tool
 * there is while building.
 */
export default function TxLog({
  address,
  abi,
  gameId,
  title,
}: {
  address: `0x${string}`;
  abi: Abi;
  /** Only show events whose indexed `gameId` matches. Omit for every event. */
  gameId?: bigint;
  title: string;
}) {
  const t = useTranslations('tictactoe.Play.txlog');
  const { chainId } = useAccount();
  const client = usePublicClient();
  const explorer = explorerName(chainId);

  const { data: rows, isLoading } = useQuery({
    queryKey: ['contract-events', chainId, address, gameId?.toString() ?? 'all'],
    enabled: !!client,
    refetchInterval: 8_000,
    queryFn: async (): Promise<Row[]> => {
      if (!client) return [];
      const logs = await client.getContractEvents({
        address,
        abi,
        fromBlock: eventsFromBlock(chainId),
        toBlock: 'latest',
      });

      return logs
        .map((log) => ({
          eventName: String(log.eventName),
          blockNumber: log.blockNumber ?? 0n,
          transactionHash: log.transactionHash as `0x${string}`,
          args: (log.args ?? {}) as Record<string, unknown>,
        }))
        .filter((row) => gameId === undefined || row.args.gameId === gameId)
        .reverse();
    },
  });

  return (
    <details className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <summary className="cursor-pointer font-semibold text-gray-900 dark:text-gray-100">
        {title}
        {rows && <span className="ml-2 font-normal text-gray-500">({rows.length})</span>}
      </summary>

      <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
        {explorer ? t('withExplorer', { explorer }) : t('noExplorer')}
      </p>

      {isLoading && <p className="mt-3 text-sm text-gray-500">{t('loading')}</p>}

      {rows && rows.length === 0 && <p className="mt-3 text-sm text-gray-500">{t('empty')}</p>}

      {rows && rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
              <tr>
                <th className="py-2 pr-4">{t('event')}</th>
                <th className="py-2 pr-4">{t('block')}</th>
                <th className="py-2 pr-4">{t('details')}</th>
                <th className="py-2">{t('tx')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rows.map((row) => {
                const url = txUrl(chainId, row.transactionHash);
                return (
                  <tr key={`${row.transactionHash}-${row.eventName}-${String(row.args.cell ?? '')}`}>
                    <td className="py-2 pr-4 font-semibold">{row.eventName}</td>
                    <td className="py-2 pr-4 font-mono text-gray-500">{row.blockNumber.toString()}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-600 dark:text-gray-300">
                      {formatArgs(row.args)}
                    </td>
                    <td className="py-2 font-mono text-xs">
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {shortAddress(row.transactionHash)} ↗
                        </a>
                      ) : (
                        <span className="text-gray-500" title={row.transactionHash}>
                          {shortAddress(row.transactionHash)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

/** Renders event arguments compactly, shortening anything address-shaped. */
function formatArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .filter(([key]) => key !== 'gameId')
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join('  ');
}

function formatValue(value: unknown): string {
  if (typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)) return shortAddress(value);
  if (typeof value === 'bigint') return value.toString();
  return String(value);
}
