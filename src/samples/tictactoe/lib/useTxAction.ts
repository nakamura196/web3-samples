'use client';

import { useCallback, useState } from 'react';
import { waitForTransactionReceipt } from 'wagmi/actions';
import type { TransactionReceipt } from 'viem';
import { useConfig } from 'wagmi';

export type TxPhase = 'idle' | 'signing' | 'confirming';

/**
 * Drives one write: ask the wallet to sign, wait for the receipt, surface the
 * error if either step fails.
 *
 * Doing this in an async event handler rather than through a chain of effects
 * keeps the two steps in one readable place, and means the caller can act on the
 * receipt — refreshing reads, reading an event out of the logs — right where the
 * action was triggered.
 */
export function useTxAction() {
  const config = useConfig();
  const [phase, setPhase] = useState<TxPhase>('idle');
  const [error, setError] = useState<unknown>(null);

  const run = useCallback(
    async (send: () => Promise<`0x${string}`>): Promise<TransactionReceipt | null> => {
      setError(null);
      setPhase('signing');
      try {
        const hash = await send();
        setPhase('confirming');
        return await waitForTransactionReceipt(config, { hash });
      } catch (caught) {
        setError(caught);
        return null;
      } finally {
        setPhase('idle');
      }
    },
    [config]
  );

  return { run, phase, error, isBusy: phase !== 'idle' };
}
