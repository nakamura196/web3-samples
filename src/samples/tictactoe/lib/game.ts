import { formatEther } from 'viem';

/** Mirrors `TicTacToe.Status`. */
export const Status = {
  None: 0,
  Open: 1,
  Active: 2,
  Finished: 3,
  Cancelled: 4,
} as const;

/** Mirrors `TicTacToe.Outcome`. */
export const Outcome = {
  None: 0,
  Win: 1,
  Draw: 2,
  Forfeit: 3,
} as const;

/** The `Game` struct as ABI decoding returns it. */
export type Game = {
  playerX: `0x${string}`;
  stake: bigint;
  playerO: `0x${string}`;
  deadline: bigint;
  timeout: number;
  winner: `0x${string}`;
  boardX: number;
  boardO: number;
  moves: number;
  status: number;
  outcome: number;
};

export type Mark = 'X' | 'O' | null;

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

/** Expands the two 9-bit masks into nine cells, row-major. */
export function decodeBoard(boardX: number, boardO: number): Mark[] {
  return Array.from({ length: 9 }, (_, cell) => {
    const bit = 1 << cell;
    if (boardX & bit) return 'X';
    if (boardO & bit) return 'O';
    return null;
  });
}

/** X moves on even move counts, O on odd ones. */
export function playerToMove(game: Game): `0x${string}` | null {
  if (game.status !== Status.Active) return null;
  return game.moves % 2 === 0 ? game.playerX : game.playerO;
}

export function isPlayer(game: Game, address?: `0x${string}`): boolean {
  if (!address) return false;
  const me = address.toLowerCase();
  return game.playerX.toLowerCase() === me || game.playerO.toLowerCase() === me;
}

export function markOf(game: Game, address?: `0x${string}`): Mark {
  if (!address) return null;
  const me = address.toLowerCase();
  if (game.playerX.toLowerCase() === me) return 'X';
  if (game.playerO.toLowerCase() === me) return 'O';
  return null;
}

export function sameAddress(a?: string, b?: string): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

export function shortAddress(address?: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Trims trailing zeros so 1.000 ETH reads as "1 ETH". */
export function formatStake(wei: bigint): string {
  const value = formatEther(wei);
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}

/** Seconds remaining until `deadline`, floored at zero. */
export function secondsLeft(deadline: bigint, now: number = Date.now()): number {
  return Math.max(0, Number(deadline) - Math.floor(now / 1000));
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}
