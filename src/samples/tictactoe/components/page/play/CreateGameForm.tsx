'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { parseEther, isAddress } from 'viem';
import { useAccount } from 'wagmi';

import { useWriteTicTacToeCreateGame } from '@/samples/tictactoe/generated/wagmi';
import { contractAddress } from '@/samples/tictactoe/lib/chains';
import { ZERO_ADDRESS } from '@/samples/tictactoe/lib/game';
import { useTxAction } from '@/samples/tictactoe/lib/useTxAction';
import TxError from '@/samples/tictactoe/components/web3/TxError';

/** Seconds each player gets per move. The contract accepts 60s … 7 days. */
const TIMEOUT_OPTIONS = [300, 3600, 86_400] as const;

export default function CreateGameForm({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations('tictactoe.Play.create');
  const { address, chainId } = useAccount();
  const contract = contractAddress(chainId);

  const [stake, setStake] = useState('0.01');
  const [timeout_, setTimeout_] = useState<number>(3600);
  const [opponent, setOpponent] = useState('');

  const { writeContractAsync } = useWriteTicTacToeCreateGame();
  const action = useTxAction();

  const trimmedOpponent = opponent.trim();
  const opponentValid = trimmedOpponent === '' || isAddress(trimmedOpponent);
  const stakeValid = /^\d*\.?\d*$/.test(stake) && stake !== '' && stake !== '.';
  const canSubmit = !!contract && !!address && stakeValid && opponentValid && !action.isBusy;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!contract || !canSubmit) return;

    const receipt = await action.run(() =>
      writeContractAsync({
        address: contract,
        args: [trimmedOpponent === '' ? ZERO_ADDRESS : (trimmedOpponent as `0x${string}`), timeout_],
        value: parseEther(stake),
      })
    );
    if (receipt) onCreated();
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
    >
      <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('stake')}
          </span>
          <input
            value={stake}
            onChange={(event) => setStake(event.target.value)}
            inputMode="decimal"
            placeholder="0.01"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
          />
          <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{t('stakeHint')}</span>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('timeout')}
          </span>
          <select
            value={timeout_}
            onChange={(event) => setTimeout_(Number(event.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
          >
            {TIMEOUT_OPTIONS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {t(`timeoutOption.${seconds}`)}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{t('timeoutHint')}</span>
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('opponent')}
          </span>
          <input
            value={opponent}
            onChange={(event) => setOpponent(event.target.value)}
            placeholder="0x… (optional)"
            spellCheck={false}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-900"
          />
          <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
            {opponentValid ? t('opponentHint') : t('opponentInvalid')}
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
      >
        {action.isBusy ? (action.phase === 'signing' ? t('signing') : t('confirming')) : t('submit')}
      </button>

      <TxError error={action.error} />
    </form>
  );
}
