'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { parseEventLogs } from 'viem';
import { useAccount } from 'wagmi';

import {
  soloTicTacToeAbi,
  useReadSoloTicTacToeGetGame,
  useWriteSoloTicTacToeNewGame,
  useWriteSoloTicTacToePlay,
} from '@/samples/tictactoe/generated/wagmi';
import { soloAddress } from '@/samples/tictactoe/lib/chains';
import {
  DIFFICULTIES,
  DIFFICULTY_KEYS,
  Difficulty,
  type DifficultyValue,
  Result,
  type SoloGame as SoloGameState,
  decodeSoloBoard,
  yourMark,
} from '@/samples/tictactoe/lib/solo';
import { useMounted } from '@/samples/tictactoe/lib/useMounted';
import { useTxAction } from '@/samples/tictactoe/lib/useTxAction';
import Board from '@/samples/tictactoe/components/page/play/Board';
import ConnectWallet from '@/samples/tictactoe/components/web3/ConnectWallet';
import TxError from '@/samples/tictactoe/components/web3/TxError';

export default function SoloGame() {
  const t = useTranslations('tictactoe.Play.solo');
  const mounted = useMounted();
  const { chainId, isConnected } = useAccount();
  const contract = soloAddress(chainId);

  const [difficulty, setDifficulty] = useState<DifficultyValue>(Difficulty.Normal);
  const [cpuFirst, setCpuFirst] = useState(false);
  const [gameId, setGameId] = useState<bigint | null>(null);
  const [attemptedCell, setAttemptedCell] = useState<number | null>(null);

  const { writeContractAsync: sendNewGame } = useWriteSoloTicTacToeNewGame();
  const { writeContractAsync: sendPlay } = useWriteSoloTicTacToePlay();

  const createAction = useTxAction();
  const moveAction = useTxAction();

  const { data: game, refetch } = useReadSoloTicTacToeGetGame({
    address: contract,
    args: gameId === null ? undefined : [gameId],
    query: { enabled: !!contract && gameId !== null },
  });

  if (!mounted) return <div className="h-96 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />;

  if (!contract) {
    return (
      <div className="space-y-6">
        <ConnectWallet />
        <p className="text-gray-500 dark:text-gray-400">{t('noContract')}</p>
      </div>
    );
  }

  async function startGame() {
    setGameId(null);
    setAttemptedCell(null);

    const receipt = await createAction.run(() =>
      sendNewGame({ address: contract!, args: [difficulty, cpuFirst] })
    );
    if (!receipt) return;

    // The id comes out of the receipt's logs. Reading gameCount instead would
    // race with anyone else creating a game in the same block.
    const [created] = parseEventLogs({
      abi: soloTicTacToeAbi,
      eventName: 'GameCreated',
      logs: receipt.logs,
    });
    if (created) setGameId(created.args.gameId);
  }

  async function playCell(cell: number) {
    if (gameId === null) return;
    setAttemptedCell(cell);
    const receipt = await moveAction.run(() => sendPlay({ address: contract!, args: [gameId, cell] }));
    setAttemptedCell(null);
    if (receipt) refetch();
  }

  const state = game as SoloGameState | undefined;
  const cells = state ? decodeSoloBoard(state) : Array<null>(9).fill(null);
  const inProgress = state?.result === Result.InProgress;

  const playableCells = new Set<number>(
    inProgress && !moveAction.isBusy ? cells.flatMap((mark, cell) => (mark === null ? [cell] : [])) : []
  );

  return (
    <div className="flex flex-col gap-8">
      <ConnectWallet />

      <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
        {t('explainer')}
      </p>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">{t('newGame')}</h2>

        <div className="mb-4 flex flex-wrap gap-6">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('difficulty')}
            </span>
            <select
              value={difficulty}
              onChange={(event) => setDifficulty(Number(event.target.value) as DifficultyValue)}
              className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
            >
              {DIFFICULTIES.map((value) => (
                <option key={value} value={value}>
                  {t(`level.${DIFFICULTY_KEYS[value]}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-end gap-2 pb-2">
            <input
              type="checkbox"
              checked={cpuFirst}
              onChange={(event) => setCpuFirst(event.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">{t('cpuFirst')}</span>
          </label>
        </div>

        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {t(`levelHint.${DIFFICULTY_KEYS[difficulty]}`)}
        </p>

        <button
          type="button"
          disabled={!isConnected || createAction.isBusy}
          onClick={startGame}
          className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {createAction.isBusy ? t('starting') : t('start')}
        </button>

        {!isConnected && <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t('connectPrompt')}</p>}
        <TxError error={createAction.error} />
      </div>

      {state && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,24rem)_1fr]">
          <div className="space-y-4">
            <Board
              cells={cells}
              onPlay={playCell}
              playableCells={playableCells}
              pendingCell={moveAction.isBusy ? attemptedCell : null}
              yourMark={yourMark(state)}
            />
            {moveAction.isBusy && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {moveAction.phase === 'signing' ? t('signing') : t('confirming')}
              </p>
            )}
            <TxError error={moveAction.error} />
          </div>

          <div className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{t('difficulty')}</dt>
                <dd className="font-semibold">
                  {t(`level.${DIFFICULTY_KEYS[state.difficulty as DifficultyValue]}`)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{t('yourMark')}</dt>
                <dd className="font-semibold">{yourMark(state)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{t('moves')}</dt>
                <dd className="font-semibold">{state.moves} / 9</dd>
              </div>
            </dl>

            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {state.result === Result.InProgress && t('yourTurn')}
              {state.result === Result.PlayerWon && t('youWon')}
              {state.result === Result.CpuWon && t('cpuWon')}
              {state.result === Result.Draw && t('draw')}
            </p>

            {state.result === Result.Draw && state.difficulty === Difficulty.Hard && (
              <p className="rounded-xl bg-gray-100 p-4 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {t('drawIsBest')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
