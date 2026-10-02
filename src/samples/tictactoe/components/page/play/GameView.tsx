'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';

import {
  useReadTicTacToeGetGame,
  useWriteTicTacToeCancelGame,
  useWriteTicTacToeClaimTimeout,
  useWriteTicTacToeJoinGame,
  useWriteTicTacToePlay,
} from '@/samples/tictactoe/generated/wagmi';
import { contractAddress } from '@/samples/tictactoe/lib/chains';
import {
  type Game,
  Outcome,
  Status,
  ZERO_ADDRESS,
  decodeBoard,
  formatStake,
  markOf,
  playerToMove,
  sameAddress,
  secondsLeft,
  shortAddress,
} from '@/samples/tictactoe/lib/game';
import { useMounted } from '@/samples/tictactoe/lib/useMounted';
import { useNow } from '@/samples/tictactoe/lib/useNow';
import { useTxAction } from '@/samples/tictactoe/lib/useTxAction';
import { ticTacToeAbi } from '@/samples/tictactoe/generated/wagmi';
import Board from '@/samples/tictactoe/components/page/play/Board';
import ChainView from '@/samples/tictactoe/components/page/play/ChainView';
import Countdown from '@/samples/tictactoe/components/page/play/Countdown';
import TxLog from '@/samples/tictactoe/components/page/play/TxLog';
import StatusBadge from '@/samples/tictactoe/components/page/play/StatusBadge';
import ConnectWallet from '@/samples/tictactoe/components/web3/ConnectWallet';
import TxError from '@/samples/tictactoe/components/web3/TxError';

export default function GameView({ gameId }: { gameId: bigint }) {
  const t = useTranslations('tictactoe.Play.game');
  const mounted = useMounted();
  const now = useNow();
  const queryClient = useQueryClient();
  const { address, chainId, isConnected } = useAccount();
  const contract = contractAddress(chainId);

  // Remembered so the board can show a ghost mark while the move is in flight.
  const [attemptedCell, setAttemptedCell] = useState<number | null>(null);

  const {
    data: game,
    isLoading,
    error: readError,
  } = useReadTicTacToeGetGame({
    address: contract,
    args: [gameId],
    // Polling is enough here: the opponent's move lands within a block or two,
    // and it keeps the deadline honest without an event subscription.
    query: { enabled: !!contract, refetchInterval: 4_000 },
  });

  const { writeContractAsync: sendPlay } = useWriteTicTacToePlay();
  const { writeContractAsync: sendJoin } = useWriteTicTacToeJoinGame();
  const { writeContractAsync: sendClaim } = useWriteTicTacToeClaimTimeout();
  const { writeContractAsync: sendCancel } = useWriteTicTacToeCancelGame();

  const playAction = useTxAction();
  const joinAction = useTxAction();
  const claimAction = useTxAction();
  const cancelAction = useTxAction();

  if (!mounted) return <div className="h-96 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />;

  if (!contract) {
    return (
      <div className="space-y-6">
        <ConnectWallet />
        <p className="text-gray-500 dark:text-gray-400">{t('noContract')}</p>
      </div>
    );
  }

  if (isLoading) return <div className="h-96 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />;

  if (readError || !game) {
    return (
      <div className="space-y-6">
        <ConnectWallet />
        <p className="text-gray-500 dark:text-gray-400">{t('notFound', { gameId: gameId.toString() })}</p>
      </div>
    );
  }

  const g = game as Game;
  const cells = decodeBoard(g.boardX, g.boardO);
  const toMove = playerToMove(g);
  const expired = secondsLeft(g.deadline, now) === 0;
  const isYourTurn = g.status === Status.Active && sameAddress(toMove ?? undefined, address) && !expired;

  const playableCells = new Set<number>(
    isYourTurn && !playAction.isBusy ? cells.flatMap((mark, cell) => (mark === null ? [cell] : [])) : []
  );

  const canJoin =
    g.status === Status.Open &&
    isConnected &&
    !sameAddress(g.playerX, address) &&
    (g.playerO === ZERO_ADDRESS || sameAddress(g.playerO, address)) &&
    !expired;

  const canClaimTimeout = g.status === Status.Active && expired;
  const canCancel = g.status === Status.Open && (sameAddress(g.playerX, address) || expired);

  async function play(cell: number) {
    setAttemptedCell(cell);
    const receipt = await playAction.run(() => sendPlay({ address: contract!, args: [gameId, cell] }));
    setAttemptedCell(null);
    if (receipt) queryClient.invalidateQueries();
  }

  async function runAndRefresh(action: ReturnType<typeof useTxAction>, send: () => Promise<`0x${string}`>) {
    const receipt = await action.run(send);
    if (receipt) queryClient.invalidateQueries();
  }

  return (
    <div className="flex flex-col gap-8">
      <ConnectWallet />

      <div className="flex flex-wrap items-center gap-4">
        <span className="font-mono text-lg text-gray-500 dark:text-gray-400">#{gameId.toString()}</span>
        <StatusBadge status={g.status} />
        <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {t('pot')}: {formatStake(g.stake * 2n)} ETH
        </span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <div className="space-y-4">
          <Board
            cells={cells}
            onPlay={play}
            playableCells={playableCells}
            pendingCell={playAction.isBusy ? attemptedCell : null}
            yourMark={markOf(g, address)}
          />
          {playAction.isBusy && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {playAction.phase === 'signing' ? t('signing') : t('confirming')}
            </p>
          )}
          <TxError error={playAction.error} />
        </div>

        <div className="space-y-6">
          <PlayerRow
            label="X"
            player={g.playerX}
            viewer={address}
            active={g.status === Status.Active && sameAddress(toMove ?? undefined, g.playerX)}
          />
          <PlayerRow
            label="O"
            player={g.playerO === ZERO_ADDRESS ? undefined : g.playerO}
            viewer={address}
            active={g.status === Status.Active && sameAddress(toMove ?? undefined, g.playerO)}
          />

          {(g.status === Status.Open || g.status === Status.Active) && (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {g.status === Status.Open ? t('joinDeadline') : t('moveDeadline')}{' '}
              <Countdown deadline={g.deadline} />
            </p>
          )}

          {g.status === Status.Active && (
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {isYourTurn
                ? t('yourTurn')
                : expired
                  ? t('clockExpired')
                  : t('theirTurn', { player: shortAddress(toMove ?? undefined) })}
            </p>
          )}

          {g.status === Status.Finished && <Result game={g} viewer={address} />}

          {g.status === Status.Cancelled && (
            <p className="rounded-xl bg-gray-100 p-4 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              {t('cancelled')}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {canJoin && (
              <ActionButton
                label={t('join', { stake: formatStake(g.stake) })}
                action={joinAction}
                onClick={() =>
                  runAndRefresh(joinAction, () =>
                    sendJoin({ address: contract, args: [gameId], value: g.stake })
                  )
                }
              />
            )}
            {canClaimTimeout && (
              <ActionButton
                label={t('claimTimeout')}
                action={claimAction}
                onClick={() => runAndRefresh(claimAction, () => sendClaim({ address: contract, args: [gameId] }))}
              />
            )}
            {canCancel && (
              <ActionButton
                label={t('cancel')}
                variant="secondary"
                action={cancelAction}
                onClick={() => runAndRefresh(cancelAction, () => sendCancel({ address: contract, args: [gameId] }))}
              />
            )}
          </div>

          <TxError error={joinAction.error} />
          <TxError error={claimAction.error} />
          <TxError error={cancelAction.error} />
        </div>
      </div>

      <ChainView address={contract} abi={ticTacToeAbi} gameId={gameId} />
      <TxLog address={contract} abi={ticTacToeAbi} gameId={gameId} title={t('eventLog')} />
    </div>
  );
}

function PlayerRow({
  label,
  player,
  viewer,
  active,
}: {
  label: 'X' | 'O';
  player?: `0x${string}`;
  viewer?: `0x${string}`;
  active: boolean;
}) {
  const t = useTranslations('tictactoe.Play.game');
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${
        active
          ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <span
        className={`text-3xl font-bold ${label === 'X' ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'}`}
      >
        {label}
      </span>
      <span className="font-mono text-sm">{player ? shortAddress(player) : t('waitingForOpponent')}</span>
      {sameAddress(player, viewer) && (
        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs dark:bg-gray-700">{t('you')}</span>
      )}
    </div>
  );
}

function Result({ game, viewer }: { game: Game; viewer?: `0x${string}` }) {
  const t = useTranslations('tictactoe.Play.game');
  const youWon = sameAddress(game.winner, viewer);
  const draw = game.outcome === Outcome.Draw;

  const message = draw
    ? t('resultDraw')
    : youWon
      ? t('resultYouWon')
      : t('resultWinner', { player: shortAddress(game.winner) });

  return (
    <div
      className={`rounded-xl p-4 ${
        draw
          ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
          : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
      }`}
    >
      <p className="text-lg font-bold">{message}</p>
      <p className="mt-1 text-sm opacity-80">
        {game.outcome === Outcome.Forfeit ? t('resultForfeit') : t('resultWithdrawNote')}
      </p>
    </div>
  );
}

function ActionButton({
  label,
  action,
  onClick,
  variant = 'primary',
}: {
  label: string;
  action: ReturnType<typeof useTxAction>;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}) {
  const t = useTranslations('tictactoe.Play.game');
  const style =
    variant === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-700'
      : 'border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={action.isBusy}
      className={`rounded-lg px-5 py-3 font-semibold transition-colors disabled:opacity-50 ${style}`}
    >
      {action.isBusy ? (action.phase === 'signing' ? t('signing') : t('confirming')) : label}
    </button>
  );
}
