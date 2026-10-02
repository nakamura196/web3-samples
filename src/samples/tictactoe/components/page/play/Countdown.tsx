'use client';

import { formatDuration, secondsLeft } from '@/samples/tictactoe/lib/game';
import { useNow } from '@/samples/tictactoe/lib/useNow';

/** Counts down between chain reads, so a stale deadline never looks frozen. */
export default function Countdown({ deadline }: { deadline: bigint }) {
  const remaining = secondsLeft(deadline, useNow());

  return (
    <span className={remaining === 0 ? 'font-mono text-red-600 dark:text-red-400' : 'font-mono'}>
      {formatDuration(remaining)}
    </span>
  );
}
