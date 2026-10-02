'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/samples/tictactoe/nav';
import StatusBadge from '@/samples/tictactoe/components/page/play/StatusBadge';
import { type Game, Outcome, Status, ZERO_ADDRESS, formatStake, sameAddress, shortAddress } from '@/samples/tictactoe/lib/game';

export default function GameCard({
  gameId,
  game,
  viewer,
}: {
  gameId: number;
  game: Game;
  viewer?: `0x${string}`;
}) {
  const t = useTranslations('tictactoe.Play.card');
  const youAreIn = sameAddress(game.playerX, viewer) || sameAddress(game.playerO, viewer);
  const invited = game.status === Status.Open && game.playerO !== ZERO_ADDRESS;

  return (
    <Link
      href={`/play/${gameId}`}
      className="block rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-sm text-gray-500 dark:text-gray-400">#{gameId}</span>
        <StatusBadge status={game.status} />
      </div>

      <p className="mb-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {formatStake(game.stake)} ETH
      </p>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{t('perPlayer')}</p>

      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500 dark:text-gray-400">X</dt>
          <dd className="font-mono">{shortAddress(game.playerX)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500 dark:text-gray-400">O</dt>
          <dd className="font-mono">
            {game.playerO === ZERO_ADDRESS ? t('waiting') : shortAddress(game.playerO)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        {youAreIn && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
            {t('yours')}
          </span>
        )}
        {invited && (
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-800 dark:bg-purple-950/50 dark:text-purple-300">
            {t('invited')}
          </span>
        )}
        {game.status === Status.Finished && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">
            {game.outcome === Outcome.Draw ? t('draw') : t('wonBy', { player: shortAddress(game.winner) })}
          </span>
        )}
      </div>
    </Link>
  );
}
