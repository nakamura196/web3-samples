'use client';

import { useTranslations } from 'next-intl';
import type { Abi } from 'viem';
import { useAccount } from 'wagmi';

import { explorerName, txUrl } from '@/samples/tictactoe/lib/explorer';
import { type ChainBlock, useGameChain } from '@/samples/tictactoe/lib/useGameChain';
import { useMounted } from '@/samples/tictactoe/lib/useMounted';

/**
 * Draws the blocks that carried one game, in order, showing how each names its
 * predecessor by hash. The point is not decoration: seeing `parentHash` of one
 * block equal the `hash` of the one before it is what "immutable" actually means.
 */
export default function ChainView({
  address,
  abi,
  gameId,
}: {
  address: `0x${string}`;
  abi: Abi;
  gameId: bigint;
}) {
  const t = useTranslations('tictactoe.Play.chain');
  const mounted = useMounted();
  const { chainId } = useAccount();
  const { data: blocks, isLoading } = useGameChain(address, abi, gameId, chainId);

  if (!mounted) return <div className="h-48 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />;
  if (isLoading) return <p className="text-sm text-gray-500 dark:text-gray-400">{t('loading')}</p>;
  if (!blocks || blocks.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t('empty')}</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('explainer')}</p>
      </div>

      <ol className="space-y-0">
        {blocks.map((block, index) => (
          <li key={block.hash}>
            {index > 0 && <Connector block={block} />}
            <BlockCard block={block} chainId={chainId} />
          </li>
        ))}
      </ol>

      <p className="text-xs text-gray-500 dark:text-gray-400">{t('footnote')}</p>
    </section>
  );
}

/** The link between two blocks: parentHash pointing back at the previous hash. */
function Connector({ block }: { block: ChainBlock }) {
  const t = useTranslations('tictactoe.Play.chain');
  const gap = block.gapBefore;

  return (
    <div className="ml-6 flex flex-col items-start gap-1 border-l-2 border-dashed border-gray-300 py-3 pl-6 dark:border-gray-600">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono text-gray-500 dark:text-gray-400">parentHash</span>
        <span className="text-gray-400">→</span>
        <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-[11px] dark:bg-gray-800">
          {short(block.parentHash)}
        </code>
        {block.linksToPrevious ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            {t('linked')}
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {t('gap', { count: gap.toString() })}
          </span>
        )}
      </div>
    </div>
  );
}

function BlockCard({ block, chainId }: { block: ChainBlock; chainId: number | undefined }) {
  const t = useTranslations('tictactoe.Play.chain');
  const explorer = explorerName(chainId);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">
          {t('block')} #{block.number.toString()}
        </h3>
        <time className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(Number(block.timestamp) * 1000).toLocaleString()}
        </time>
      </div>

      <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <dt className="font-mono text-gray-500 dark:text-gray-400">hash</dt>
        <dd>
          <code className="break-all font-mono text-[11px] text-gray-700 dark:text-gray-200">{block.hash}</code>
        </dd>
        <dt className="font-mono text-gray-500 dark:text-gray-400">txs</dt>
        <dd className="text-gray-700 dark:text-gray-200">
          {t('txCount', { count: block.transactionCount })}
        </dd>
      </dl>

      <ul className="space-y-2">
        {block.events.map((event) => {
          const url = txUrl(chainId, event.transactionHash);
          return (
            <li
              key={`${event.transactionHash}-${event.eventName}-${String(event.args.cell ?? '')}`}
              className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
                  {event.eventName}
                </span>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
                    title={explorer}
                  >
                    {short(event.transactionHash)} ↗
                  </a>
                ) : (
                  <code
                    className="font-mono text-xs text-gray-500"
                    title={event.transactionHash}
                  >
                    {short(event.transactionHash)}
                  </code>
                )}
              </div>
              <p className="font-mono text-[11px] text-gray-600 dark:text-gray-300">{formatArgs(event.args)}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function short(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

function formatArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .filter(([key]) => key !== 'gameId')
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join('  ');
}

function formatValue(value: unknown): string {
  if (typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)) {
    return `${value.slice(0, 6)}…${value.slice(-4)}`;
  }
  if (typeof value === 'bigint') return value.toString();
  return String(value);
}
