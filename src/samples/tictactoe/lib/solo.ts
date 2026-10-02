/** Mirrors `SoloTicTacToe.Difficulty`. */
export const Difficulty = {
  Easy: 0,
  Normal: 1,
  Hard: 2,
} as const;

export type DifficultyValue = (typeof Difficulty)[keyof typeof Difficulty];

export const DIFFICULTIES: DifficultyValue[] = [Difficulty.Easy, Difficulty.Normal, Difficulty.Hard];

export const DIFFICULTY_KEYS: Record<DifficultyValue, string> = {
  [Difficulty.Easy]: 'easy',
  [Difficulty.Normal]: 'normal',
  [Difficulty.Hard]: 'hard',
};

/** Mirrors `SoloTicTacToe.Result`. */
export const Result = {
  InProgress: 0,
  PlayerWon: 1,
  CpuWon: 2,
  Draw: 3,
} as const;

/** The `Solo` struct as ABI decoding returns it. */
export type SoloGame = {
  player: `0x${string}`;
  boardPlayer: number;
  boardCpu: number;
  moves: number;
  difficulty: number;
  result: number;
  cpuFirst: boolean;
};

/**
 * Nine cells, row-major. The practice contract tracks "you" and "the contract"
 * rather than X and O, so the mark each side draws depends on who opened.
 */
export function decodeSoloBoard(game: SoloGame): ('X' | 'O' | null)[] {
  const youAre = game.cpuFirst ? 'O' : 'X';
  const cpuIs = game.cpuFirst ? 'X' : 'O';

  return Array.from({ length: 9 }, (_, cell) => {
    const bit = 1 << cell;
    if (game.boardPlayer & bit) return youAre;
    if (game.boardCpu & bit) return cpuIs;
    return null;
  });
}

export function yourMark(game: SoloGame): 'X' | 'O' {
  return game.cpuFirst ? 'O' : 'X';
}
