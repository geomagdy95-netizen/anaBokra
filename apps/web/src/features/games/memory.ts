import { mulberry32 } from '../path/rng';

/**
 * Remember the path (visual working memory, a Corsi-style span task): tiles on a 3×3 board light up
 * one after another; the player taps them in the same order. The path starts at 3 tiles and grows by
 * one after each success; two misses in a row at the same length end the game. Span = the longest
 * path repeated correctly.
 */

export const BOARD = 9;
export const START = 3;
export const MAX = 9;

/** A path of `length` tiles with no tile twice in a row. */
export function memoryPath(length: number, seed: number): number[] {
  const rng = mulberry32(seed);
  const out: number[] = [];
  while (out.length < length) {
    const t = Math.floor(rng() * BOARD);
    if (t !== out[out.length - 1]) out.push(t);
  }
  return out;
}

export interface MemoryTrial {
  length: number;
  correct: boolean;
}

/** What comes next: the length of the next path, or null when the game is over. */
export function nextLength(trials: MemoryTrial[]): number | null {
  if (!trials.length) return START;
  const last = trials[trials.length - 1]!;
  if (last.correct) return last.length >= MAX ? null : last.length + 1;
  const before = trials[trials.length - 2];
  if (before && !before.correct && before.length === last.length) return null;
  return last.length;
}

export function memorySummary(trials: MemoryTrial[]) {
  const right = trials.filter((t) => t.correct);
  return { span: right.reduce((m, t) => Math.max(m, t.length), 0), trials: trials.length, correct: right.length };
}
