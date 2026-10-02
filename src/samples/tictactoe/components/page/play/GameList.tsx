'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAccount } from 'wagmi';

import { useReadTicTacToeGameCount, useReadTicTacToeGetGames } from '@/samples/tictactoe/generated/wagmi';
import { contractAddress } from '@/samples/tictactoe/lib/chains';
import { type Game, Status, sameAddress } from '@/samples/tictactoe/lib/game';
import GameCard from '@/samples/tictactoe/components/page/play/GameCard';

/** How many games the lobby pulls in one call. */
const PAGE_SIZE = 24;

type Filter = 'all' | 'open' | 'mine';

export default function GameList() {
  const t = useTranslations('tictactoe.Play.list');
  const { address, chainId } = useAccount();
  const contract = contractAddress(chainId);
  const [filter, setFilter] = useState<Filter>('all');

  const { data: count } = useReadTicTacToeGameCount({
    address: contract,
    query: { enabled: !!contract, refetchInterval: 5_000 },
  });

  const total = count === undefined ? 0 : Number(count);
  // Games are stored oldest-first, so read the tail and reverse it for the lobby.
  const offset = Math.max(0, total - PAGE_SIZE);

  const { data: page, isLoading } = useReadTicTacToeGetGames({
    address: contract,
    args: [BigInt(offset), BigInt(PAGE_SIZE)],
    query: { enabled: !!contract && total > 0, refetchInterval: 5_000 },
  });

  const rows = ((page ?? []) as readonly Game[])
    .map((game, index) => ({ gameId: offset + index, game }))
    .reverse()
    .filter(({ game }) => {
      if (filter === 'open') return game.status === Status.Open;
      if (filter === 'mine') return sameAddress(game.playerX, address) || sameAddress(game.playerO, address);
      return true;
    });

  if (!contract) {
    return <p className="text-gray-500 dark:text-gray-400">{t('noContract')}</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {t('title', { count: total })}
        </h2>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
          {(['all', 'open', 'mine'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                filter === value
                  ? 'bg-white font-semibold shadow-sm dark:bg-gray-700'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
              }`}
            >
              {t(`filter.${value}`)}
            </button>
          ))}
        </div>
      </div>

      {isLoading && total > 0 && <p className="text-gray-500 dark:text-gray-400">{t('loading')}</p>}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {t('empty')}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ gameId, game }) => (
            <GameCard key={gameId} gameId={gameId} game={game} viewer={address} />
          ))}
        </div>
      )}
    </div>
  );
}
