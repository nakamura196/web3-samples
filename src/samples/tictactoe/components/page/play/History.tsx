'use client';

import { useTranslations } from 'next-intl';
import { useAccount, useReadContracts } from 'wagmi';

import { soloTicTacToeAbi, ticTacToeAbi } from '@/samples/tictactoe/generated/wagmi';
import { Link } from '@/samples/tictactoe/nav';
import { contractAddress, soloAddress } from '@/samples/tictactoe/lib/chains';
import { explorerName, txUrl } from '@/samples/tictactoe/lib/explorer';
import {
  type Game,
  Outcome,
  Status,
  formatStake,
  sameAddress,
  shortAddress,
} from '@/samples/tictactoe/lib/game';
import { Result, type SoloGame } from '@/samples/tictactoe/lib/solo';
import { useGameHistory } from '@/samples/tictactoe/lib/useGameHistory';
import { useMounted } from '@/samples/tictactoe/lib/useMounted';
import ConnectWallet from '@/samples/tictactoe/components/web3/ConnectWallet';
import StatusBadge from '@/samples/tictactoe/components/page/play/StatusBadge';
import TxLog from '@/samples/tictactoe/components/page/play/TxLog';

export default function History() {
  const t = useTranslations('tictactoe.Play.history');
  const mounted = useMounted();
  const { address, chainId, isConnected } = useAccount();

  const pvp = contractAddress(chainId);
  const solo = soloAddress(chainId);

  const { data: entries, isLoading } = useGameHistory(address, pvp, solo, chainId);

  // One multicall for every game the events pointed at, rather than a request
  // per row.
  const { data: states } = useReadContracts({
    contracts: (entries ?? []).map((entry) =>
      entry.kind === 'pvp'
        ? ({ address: pvp, abi: ticTacToeAbi, functionName: 'getGame', args: [entry.gameId] } as const)
        : ({ address: solo, abi: soloTicTacToeAbi, functionName: 'getGame', args: [entry.gameId] } as const)
    ),
    query: { enabled: (entries?.length ?? 0) > 0 },
  });

  if (!mounted) return <div className="h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />;

  return (
    <div className="flex flex-col gap-8">
      <ConnectWallet />

      {!isConnected ? (
        <p className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {t('connectPrompt')}
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('explainer')}</p>

          {isLoading && <p className="text-gray-500 dark:text-gray-400">{t('loading')}</p>}

          {entries && entries.length === 0 && (
            <p className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">
              {t('empty')}
            </p>
          )}

          {entries && entries.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="py-2 pr-4">{t('mode')}</th>
                    <th className="py-2 pr-4">{t('game')}</th>
                    <th className="py-2 pr-4">{t('state')}</th>
                    <th className="py-2 pr-4">{t('result')}</th>
                    <th className="py-2 pr-4">{t('stake')}</th>
                    <th className="py-2">{t('startedIn')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {entries.map((entry, index) => {
                    const state = states?.[index];
                    const value = state?.status === 'success' ? state.result : undefined;
                    const url = txUrl(chainId, entry.transactionHash);

                    return (
                      <tr key={`${entry.kind}-${entry.gameId}-${entry.transactionHash}`}>
                        <td className="py-3 pr-4">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700">
                            {t(entry.kind)}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-mono">
                          <Link
                            href={
                              entry.kind === 'pvp'
                                ? `/play/${entry.gameId}`
                                : `/play/solo/${entry.gameId}`
                            }
                            className="text-blue-600 hover:underline dark:text-blue-400"
                          >
                            #{entry.gameId.toString()}
                          </Link>
                        </td>
                        <td className="py-3 pr-4">
                          {entry.kind === 'pvp' && value ? (
                            <StatusBadge status={(value as Game).status} />
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {entry.kind === 'pvp'
                            ? pvpResult(value as Game | undefined, address, t)
                            : soloResult(value as SoloGame | undefined, t)}
                        </td>
                        <td className="py-3 pr-4 font-mono">
                          {entry.kind === 'pvp' && value
                            ? `${formatStake((value as Game).stake)} ETH`
                            : t('free')}
                        </td>
                        <td className="py-3 font-mono text-xs">
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {entry.blockNumber.toString()} ↗
                            </a>
                          ) : (
                            <span className="text-gray-500" title={entry.transactionHash}>
                              {entry.blockNumber.toString()}
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

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('developer')}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {explorerName(chainId) ? t('devWithExplorer') : t('devNoExplorer')}
            </p>
            {pvp && <TxLog address={pvp} abi={ticTacToeAbi} title={t('pvpEvents')} />}
            {solo && <TxLog address={solo} abi={soloTicTacToeAbi} title={t('soloEvents')} />}
          </div>
        </>
      )}
    </div>
  );
}

type Translate = ReturnType<typeof useTranslations<'Play.history'>>;

function pvpResult(game: Game | undefined, viewer: `0x${string}` | undefined, t: Translate) {
  if (!game) return <span className="text-gray-400">—</span>;
  if (game.status !== Status.Finished) return <span className="text-gray-400">—</span>;
  if (game.outcome === Outcome.Draw) return <span>{t('draw')}</span>;

  const won = sameAddress(game.winner, viewer);
  return (
    <span className={won ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-300'}>
      {won ? t('won') : t('lostTo', { player: shortAddress(game.winner) })}
      {game.outcome === Outcome.Forfeit && ` (${t('forfeit')})`}
    </span>
  );
}

function soloResult(game: SoloGame | undefined, t: Translate) {
  if (!game) return <span className="text-gray-400">—</span>;
  const labels: Record<number, string> = {
    [Result.InProgress]: t('inProgress'),
    [Result.PlayerWon]: t('won'),
    [Result.CpuWon]: t('lostToCpu'),
    [Result.Draw]: t('draw'),
  };
  const won = game.result === Result.PlayerWon;
  return (
    <span className={won ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-300'}>
      {labels[game.result] ?? '—'}
    </span>
  );
}
