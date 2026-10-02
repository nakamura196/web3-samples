'use client';

import { useTranslations } from 'next-intl';
import { useAccount } from 'wagmi';

import { useReadTicTacToePending, useWriteTicTacToeWithdraw } from '@/samples/tictactoe/generated/wagmi';
import { contractAddress } from '@/samples/tictactoe/lib/chains';
import { formatStake } from '@/samples/tictactoe/lib/game';
import { useTxAction } from '@/samples/tictactoe/lib/useTxAction';
import TxError from '@/samples/tictactoe/components/web3/TxError';

/**
 * Winnings and refunds are credited, not pushed, so the player claims them here.
 * That is what keeps a wallet that reverts on receive from freezing the contract.
 */
export default function PendingBalance() {
  const t = useTranslations('tictactoe.Play.pending');
  const { address, chainId } = useAccount();
  const contract = contractAddress(chainId);

  const { data: balance, refetch } = useReadTicTacToePending({
    address: contract,
    args: address ? [address] : undefined,
    query: { enabled: !!contract && !!address, refetchInterval: 5_000 },
  });

  const { writeContractAsync } = useWriteTicTacToeWithdraw();
  const action = useTxAction();

  async function withdraw() {
    if (!contract) return;
    const receipt = await action.run(() => writeContractAsync({ address: contract }));
    if (receipt) refetch();
  }

  if (!contract || !address || !balance) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/30">
      <div>
        <p className="text-sm text-emerald-800 dark:text-emerald-300">{t('label')}</p>
        <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-200">
          {formatStake(balance)} ETH
        </p>
      </div>
      <button
        type="button"
        onClick={withdraw}
        disabled={action.isBusy}
        className="rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
      >
        {action.isBusy ? (action.phase === 'signing' ? t('signing') : t('confirming')) : t('withdraw')}
      </button>
      <div className="w-full">
        <TxError error={action.error} />
      </div>
    </div>
  );
}
