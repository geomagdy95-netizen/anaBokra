import { mulberry32, type Rng } from '../path/rng';

/**
 * Quick numbers (number sense): our own items, all numbers and symbols, so they read the same in
 * Arabic and English. Level 1: what comes next in an adding sequence; level 2: a doubling or
 * alternating sequence; level 3: a percentage of an amount; level 4: a sequence whose steps grow, or
 * a two-step sum. Four options; the wrong ones are the slips people really make. No clock.
 */

export interface NumberItem {
  level: number;
  /** What is shown: a sequence ending in "?", or an expression ending in "= ?". */
  kind: 'sequence' | 'expression';
  terms: string[];
  options: number[];
  answer: number;
}

const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const shuffle = <T,>(rng: Rng, xs: T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

function withOptions(rng: Rng, level: number, kind: NumberItem['kind'], terms: string[], right: number, slips: number[]): NumberItem {
  const wrong: number[] = [];
  for (const s of [...slips, right + 1, right - 1, right + 2, right + 10, right - 10]) {
    if (wrong.length === 3) break;
    if (s > 0 && s !== right && !wrong.includes(s) && Number.isInteger(s)) wrong.push(s);
  }
  const options = shuffle(rng, [right, ...wrong]);
  return { level, kind, terms, options, answer: options.indexOf(right) };
}

export function numberItem(level: number, seed: number): NumberItem {
  const rng = mulberry32(seed);
  if (level <= 1) {
    const step = int(rng, 3, 9);
    const start = int(rng, 1, 20);
    const seq = [0, 1, 2, 3].map((i) => start + i * step);
    const right = start + 4 * step;
    return withOptions(rng, 1, 'sequence', [...seq.map(String), '?'], right, [right - step + 1, right + step, right - 2]);
  }
  if (level === 2) {
    if (rng() < 0.5) {
      const start = int(rng, 2, 6);
      const seq = [0, 1, 2, 3].map((i) => start * 2 ** i);
      const right = start * 16;
      return withOptions(rng, 2, 'sequence', [...seq.map(String), '?'], right, [seq[3]! + (seq[3]! - seq[2]!), right + start * 2, right - start]);
    }
    const a = int(rng, 2, 6);
    const b = int(rng, 7, 12);
    const seq = [int(rng, 1, 9)];
    for (let i = 1; i < 5; i++) seq.push(seq[i - 1]! + (i % 2 ? a : b));
    const right = seq[4]! + a;
    return withOptions(rng, 2, 'sequence', [...seq.map(String), '?'], right, [seq[4]! + b, right + 1, seq[4]! + (a + b) / 2]);
  }
  if (level === 3) {
    const pct = [10, 20, 25, 50, 75][int(rng, 0, 4)]!;
    const base = pct === 25 || pct === 75 ? 4 * int(rng, 5, 60) : 10 * int(rng, 3, 60);
    const right = (base * pct) / 100;
    return withOptions(rng, 3, 'expression', [`${pct}%`, '×', String(base), '= ?'], right, [base - right, right * 2, right + 10]);
  }
  if (rng() < 0.5) {
    const start = int(rng, 1, 6);
    const d = int(rng, 1, 4);
    const grow = int(rng, 1, 3);
    const seq = [start];
    for (let i = 0; i < 4; i++) seq.push(seq[i]! + d + i * grow);
    const right = seq[4]! + d + 4 * grow;
    return withOptions(rng, 4, 'sequence', [...seq.map(String), '?'], right, [seq[4]! + (seq[4]! - seq[3]!), right + grow, right - 1]);
  }
  const a = int(rng, 3, 9);
  const b = int(rng, 12, 45);
  const c = int(rng, 5, 30);
  const right = a * b - c;
  return withOptions(rng, 4, 'expression', [String(a), '×', String(b), '−', String(c), '= ?'], right, [a * (b - c), a * b + c, right + 10]);
}

export const NUMBER_LEVELS = [1, 1, 2, 2, 3, 3, 4, 4] as const;

export function numberRun(seed: number): { practice: NumberItem; items: NumberItem[] } {
  return { practice: numberItem(1, seed ^ 0x2c1b3c6d), items: NUMBER_LEVELS.map((level, i) => numberItem(level, seed + i * 104729)) };
}
