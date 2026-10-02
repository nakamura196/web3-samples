'use client';

import type { Mark } from '@/samples/tictactoe/lib/game';

const CELL_LABELS = ['↖', '↑', '↗', '←', '·', '→', '↙', '↓', '↘'];

export default function Board({
  cells,
  onPlay,
  playableCells,
  pendingCell,
  yourMark,
}: {
  cells: Mark[];
  onPlay?: (cell: number) => void;
  /** Cells the connected player may click right now. */
  playableCells: Set<number>;
  /** Cell whose transaction is in flight, shown as a ghost mark. */
  pendingCell?: number | null;
  yourMark?: Mark;
}) {
  return (
    <div
      role="grid"
      aria-label="Tic-tac-toe board"
      className="grid aspect-square w-full max-w-sm grid-cols-3 gap-2"
    >
      {cells.map((mark, cell) => {
        const playable = playableCells.has(cell);
        const isPending = pendingCell === cell;
        const shown = mark ?? (isPending ? yourMark ?? null : null);

        return (
          <button
            key={cell}
            type="button"
            role="gridcell"
            aria-label={`Cell ${cell + 1}${mark ? `: ${mark}` : ''}`}
            disabled={!playable}
            onClick={() => onPlay?.(cell)}
            className={[
              'flex items-center justify-center rounded-xl border-2 text-5xl font-bold transition-all sm:text-6xl',
              'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
              playable ? 'cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40' : 'cursor-default',
              isPending ? 'opacity-40' : '',
              shown === 'X' ? 'text-blue-600 dark:text-blue-400' : '',
              shown === 'O' ? 'text-rose-600 dark:text-rose-400' : '',
            ].join(' ')}
          >
            {shown ?? (
              <span className="text-2xl text-gray-200 dark:text-gray-700" aria-hidden="true">
                {playable ? CELL_LABELS[cell] : ''}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
