'use client';

import { useTranslations } from 'next-intl';
import { useAccount } from 'wagmi';

import { soloTicTacToeAbi, useReadSoloTicTacToeGetGame } from '@/samples/tictactoe/generated/wagmi';
import { Link } from '@/samples/tictactoe/nav';
import { soloAddress } from '@/samples/tictactoe/lib/chains';
import { shortAddress } from '@/samples/tictactoe/lib/game';
import {
  DIFFICULTY_KEYS,
  type DifficultyValue,
  Result,
  type SoloGame,
  decodeSoloBoard,
  yourMark,
} from '@/samples/tictactoe/lib/solo';
import { useMounted } from '@/samples/tictactoe/lib/useMounted';
import Board from '@/samples/tictactoe/components/page/play/Board';
import ChainView from '@/samples/tictactoe/components/page/play/ChainView';
import TxLog from '@/samples/tictactoe/components/page/play/TxLog';
import ConnectWallet from '@/samples/tictactoe/components/web3/ConnectWallet';

/** Read-only view of one practice game, plus everything it left on the chain. */
export default function SoloGameDetail({ gameId }: { gameId: bigint }) {
  const t = useTranslations('tictactoe.Play.solo');
  const tGame = useTranslations('tictactoe.Play.game');
  const mounted = useMounted();
  const { chainId } = useAccount();
  const contract = soloAddress(chainId);

  const { data: game, isLoading } = useReadSoloTicTacToeGetGame({
    address: contract,
    args: [gameId],
    query: { enabled: !!contract, refetchInterval: 6_000 },
  });

  if (!mounted || isLoading) {
    return <div className="h-96 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />;
  }

  if (!contract) {
    return (
      <div className="space-y-6">
        <ConnectWallet />
        <p className="text-gray-500 dark:text-gray-400">{t('noContract')}</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="space-y-6">
        <ConnectWallet />
        <p className="text-gray-500 dark:text-gray-400">{tGame('notFound', { gameId: gameId.toString() })}</p>
      </div>
    );
  }

  const state = game as SoloGame;
  const cells = decodeSoloBoard(state);
  const resultLabels: Record<number, string> = {
    [Result.InProgress]: t('inProgressLabel'),
    [Result.PlayerWon]: t('youWon'),
    [Result.CpuWon]: t('cpuWon'),
    [Result.Draw]: t('draw'),
  };

  return (
    <div className="flex flex-col gap-8">
      <ConnectWallet />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <Board cells={cells} playableCells={new Set()} yourMark={yourMark(state)} />

        <dl className="space-y-2 text-sm">
          <Row label={t('player')} value={shortAddress(state.player)} />
          <Row
            label={t('difficulty')}
            value={t(`level.${DIFFICULTY_KEYS[state.difficulty as DifficultyValue]}`)}
          />
          <Row label={t('yourMark')} value={yourMark(state)} />
          <Row label={t('moves')} value={`${state.moves} / 9`} />
          <Row label={t('resultLabel')} value={resultLabels[state.result] ?? '—'} />

          {state.result === Result.InProgress && (
            <p className="pt-4">
              <Link
                href="/play/solo"
                className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-700"
              >
                {t('backToPlay')}
              </Link>
            </p>
          )}
        </dl>
      </div>

      <ChainView address={contract} abi={soloTicTacToeAbi} gameId={gameId} />
      <TxLog address={contract} abi={soloTicTacToeAbi} gameId={gameId} title={tGame('eventLog')} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-2 dark:border-gray-700">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
