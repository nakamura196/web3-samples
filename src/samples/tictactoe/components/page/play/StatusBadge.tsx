'use client';

import { useTranslations } from 'next-intl';

import { Status } from '@/samples/tictactoe/lib/game';

const STYLES: Record<number, string> = {
  [Status.Open]: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  [Status.Active]: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  [Status.Finished]: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  [Status.Cancelled]: 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const KEYS: Record<number, string> = {
  [Status.Open]: 'open',
  [Status.Active]: 'active',
  [Status.Finished]: 'finished',
  [Status.Cancelled]: 'cancelled',
};

export default function StatusBadge({ status }: { status: number }) {
  const t = useTranslations('tictactoe.Play.status');
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STYLES[status] ?? STYLES[Status.Cancelled]}`}>
      {t(KEYS[status] ?? 'cancelled')}
    </span>
  );
}
