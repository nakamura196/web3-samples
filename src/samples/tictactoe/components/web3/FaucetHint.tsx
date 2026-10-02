'use client';

import { useTranslations } from 'next-intl';

import { faucetsFor } from '@/samples/tictactoe/lib/faucets';

/**
 * Shown when the connected wallet has nothing to spend. Without this, a visitor
 * arriving with an empty testnet account has no way to know what to do next.
 */
export default function FaucetHint({ chainId }: { chainId: number | undefined }) {
  const t = useTranslations('tictactoe.Play.faucet');
  const faucets = faucetsFor(chainId);
  if (faucets.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
      <p className="mb-1 font-semibold text-amber-900 dark:text-amber-200">{t('title')}</p>
      <p className="mb-3 text-sm text-amber-800 dark:text-amber-300">{t('body')}</p>

      <ul className="space-y-2">
        {faucets.map((faucet) => (
          <li key={faucet.name} className="flex flex-wrap items-center gap-2 text-sm">
            {faucet.url ? (
              <a
                href={faucet.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-amber-900 underline hover:no-underline dark:text-amber-200"
              >
                {faucet.name} ↗
              </a>
            ) : (
              <code className="rounded bg-white px-2 py-0.5 font-mono text-xs dark:bg-gray-900">
                {faucet.name}
              </code>
            )}
            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-amber-900 dark:bg-gray-900 dark:text-amber-200">
              {t(`requires.${faucet.requires}`)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
