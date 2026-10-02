'use client';

import { useTranslations } from 'next-intl';

import { describeTxError } from '@/samples/tictactoe/lib/errors';

/**
 * Turns a viem error into a sentence. Reverts carrying one of the contract's
 * custom errors get a translated explanation; anything else falls back to
 * viem's own short message.
 */
export default function TxError({ error }: { error: unknown }) {
  const t = useTranslations('tictactoe.Play.errors');
  const described = describeTxError(error);
  if (!described) return null;

  const message = described.key && t.has(described.key) ? t(described.key) : described.message;

  return (
    <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
      {message}
    </p>
  );
}
