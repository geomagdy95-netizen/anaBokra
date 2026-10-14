import { mulberry32, type Rng } from '../path/rng';

/**
 * Pattern logic: our own matrix-reasoning puzzles, generated from rules (no copyrighted test items).
 * A 3×3 grid of figures; the bottom-right cell is missing; pick it from four options. Each figure has
 * four features with three values each. In an item some features follow a rule and the rest stay the
 * same everywhere:
 * - `col`: the value depends on the column (the same along each column, changes across a row);
 * - `row`: the value depends on the row;
 * - `mix`: every row and every column holds all three values once (a Latin square).
 * Every wrong option differs from the answer in exactly one feature, so only checking all the rules
 * finds the answer. Prototype for the psychologist (docs/product/games.md); not scored into results.
 */

export const FEATURES = ['count', 'shape', 'color', 'fill'] as const;
export type Feature = (typeof FEATURES)[number];
export type Rule = 'col' | 'row' | 'mix';

/** Each feature value is 0–2: count 1–3; shape circle/square/triangle; colour violet/apricot/teal; fill solid/light/outline. */
export type Figure = Record<Feature, number>;

export interface PatternItem {
  level: number;
  rules: Partial<Record<Feature, Rule>>;
  /** Row-major, 9 cells; the last one is the answer (hidden in the game). */
  cells: Figure[];
  options: Figure[];
  answer: number;
}

const shuffle = <T,>(rng: Rng, xs: T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

/** What changes at each level: how many features follow a rule, and which rules are allowed. */
const LEVELS: Record<number, { features: number; rules: Rule[] }> = {
  1: { features: 1, rules: ['col'] },
  2: { features: 2, rules: ['col', 'row'] },
  3: { features: 2, rules: ['mix', 'col'] },
  4: { features: 3, rules: ['mix', 'col', 'row'] },
};

export const sameFigure = (a: Figure, b: Figure) => FEATURES.every((f) => a[f] === b[f]);

export function patternItem(level: number, seed: number): PatternItem {
  const rng = mulberry32(seed);
  const spec = LEVELS[level] ?? LEVELS[4]!;
  const varying = shuffle(rng, [...FEATURES]).slice(0, spec.features);
  const rules: Partial<Record<Feature, Rule>> = {};
  varying.forEach((f, i) => (rules[f] = spec.rules[i % spec.rules.length]!));
  const base = Object.fromEntries(FEATURES.map((f) => [f, Math.floor(rng() * 3)])) as Figure;
  const order = Object.fromEntries(FEATURES.map((f) => [f, shuffle(rng, [0, 1, 2])])) as Record<Feature, number[]>;
  const shift = rng() < 0.5 ? 1 : 2;

  const cells: Figure[] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      const fig = { ...base };
      for (const f of varying) {
        const rule = rules[f]!;
        const k = rule === 'col' ? c : rule === 'row' ? r : (r * shift + c) % 3;
        fig[f] = order[f][k]!;
      }
      cells.push(fig);
    }

  const answerFig = cells[8]!;
  // Wrong options: change one feature each; prefer the ruled features, so each rule is tested.
  const changeable = [...varying, ...shuffle(rng, FEATURES.filter((f) => !varying.includes(f)))];
  const wrong: Figure[] = [];
  for (const f of changeable) {
    if (wrong.length === 3) break;
    for (const v of shuffle(rng, [0, 1, 2])) {
      const cand = { ...answerFig, [f]: v };
      if (v === answerFig[f] || wrong.some((w) => sameFigure(w, cand))) continue;
      wrong.push(cand);
      break;
    }
  }
  const options = shuffle(rng, [answerFig, ...wrong]);
  return { level, rules, cells, options, answer: options.findIndex((o) => sameFigure(o, answerFig)) };
}

/** The prototype run: one practice item (with feedback), then eight items from easy to hard. */
export const PATTERN_LEVELS = [1, 1, 2, 2, 3, 3, 4, 4] as const;

export function patternRun(seed: number): { practice: PatternItem; items: PatternItem[] } {
  return {
    practice: patternItem(1, seed ^ 0x5bd1e995),
    items: PATTERN_LEVELS.map((level, i) => patternItem(level, seed + i * 7919)),
  };
}

export interface PatternAnswer {
  level: number;
  correct: boolean;
  ms: number;
}

/**
 * What the run shows: how many were right overall and by level, the hardest level solved, and time
 * per item. For the pilot these are research measures only, never a mark shown as a number.
 */
export function patternSummary(answers: PatternAnswer[]) {
  const right = answers.filter((a) => a.correct);
  const byLevel = Object.fromEntries([1, 2, 3, 4].map((l) => [l, answers.filter((a) => a.level === l && a.correct).length]));
  const times = answers.map((a) => a.ms).sort((a, b) => a - b);
  const median = times.length ? times[Math.floor(times.length / 2)]! : 0;
  return {
    correct: right.length,
    total: answers.length,
    byLevel,
    hardestSolved: right.reduce((m, a) => Math.max(m, a.level), 0),
    medianMs: median,
    totalMs: answers.reduce((s, a) => s + a.ms, 0),
  };
}
