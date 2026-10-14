import type { AbilityDomain } from '@anabokra/engine';

import { mulberry32 } from '../path/rng';
import type { MemoryTrial } from './memory';
import type { ChoiceAnswer } from './pattern';

/**
 * Game scores and how they compare with other players (docs/product/games.md).
 * - Points: the choice games give a right answer as many points as its level (1–4; at most 20); the
 *   memory game scores its span (0–9). Patience is a way of playing, not a skill, so it has no points.
 * - Norms: how many players of an age band got each score (a histogram). Only anonymous scores from
 *   players who opted in to statistics are counted, and nobody is compared until enough have played.
 * - Standing: the share of comparable players scored below (ties count half), 0–1. In the assessment
 *   it is the measured part of an ability (logic, numbers, spatial), blended with the self-rating.
 */

export const RANKED_GAMES = ['pattern', 'numbers', 'rotation', 'memory'] as const;
export type RankedGame = (typeof RANKED_GAMES)[number];
export type AgeBand = '15-17' | '18-20' | '21-25' | '26plus';

/** Which ability each game measures in the assessment. Memory has no ability of its own yet. */
export const GAME_ABILITY: Partial<Record<RankedGame, AbilityDomain>> = { pattern: 'logical', numbers: 'numerical', rotation: 'spatial' };

/** Time for the whole game, seconds (choice games). Generous: speed is not the point, focus is. */
export const TIME_LIMIT: Partial<Record<RankedGame, number>> = { pattern: 180, numbers: 150, rotation: 120 };

export const MAX_POINTS: Record<RankedGame, number> = { pattern: 20, numbers: 20, rotation: 20, memory: 9 };

/** Players needed before standings are shown or used. */
export const MIN_PLAYERS = 100;

export const choicePoints = (answers: ChoiceAnswer[]) => answers.reduce((s, a) => s + (a.correct ? a.level : 0), 0);
export const memoryPoints = (trials: MemoryTrial[]) => trials.reduce((m, t) => (t.correct ? Math.max(m, t.length) : m), 0);

/** counts[s] = players who scored s. */
export interface ScoreHistogram {
  n: number;
  counts: number[];
}
export type GameNorms = Partial<Record<RankedGame, Partial<Record<AgeBand | 'all', ScoreHistogram>>>>;

/** The comparison group to use: the player's age band if it has enough players, else everyone, else none. */
export function normGroup(norms: GameNorms | null | undefined, game: RankedGame, band: AgeBand | null): { hist: ScoreHistogram; scope: 'age' | 'all' } | null {
  const g = norms?.[game];
  const own = band ? g?.[band] : undefined;
  if (own && own.n >= MIN_PLAYERS) return { hist: own, scope: 'age' };
  if (g?.all && g.all.n >= MIN_PLAYERS) return { hist: g.all, scope: 'all' };
  return null;
}

/** Share of players scored below `score`, counting ties as half (a mid-rank percentile), 0–1. */
export function standing(score: number, hist: ScoreHistogram): number {
  if (!hist.n) return 0.5;
  let below = 0;
  for (let s = 0; s < Math.min(score, hist.counts.length); s++) below += hist.counts[s] ?? 0;
  const same = hist.counts[score] ?? 0;
  return Math.min(1, Math.max(0, (below + same / 2) / hist.n));
}

export type StandingBand = 'top10' | 'top25' | 'aboveMiddle' | 'middle' | 'below';

/** How a standing is put into words: honest and plain, never "bottom" or "last". */
export function standingBand(p: number): StandingBand {
  return p >= 0.9 ? 'top10' : p >= 0.75 ? 'top25' : p >= 0.5 ? 'aboveMiddle' : p >= 0.25 ? 'middle' : 'below';
}

/**
 * Sample players for previewing standings before real ones exist (dev only): a bell-shaped spread of
 * scores. Never used for a real player's result.
 */
export function sampleNorms(seed = 7, n = 1000): GameNorms {
  const rng = mulberry32(seed);
  const hist = (max: number, mean: number, sd: number): ScoreHistogram => {
    const counts = Array.from({ length: max + 1 }, () => 0);
    for (let i = 0; i < n; i++) {
      // Sum of uniforms ≈ normal.
      const z = (rng() + rng() + rng() + rng() - 2) * Math.sqrt(3);
      counts[Math.max(0, Math.min(max, Math.round(mean + z * sd)))]! += 1;
    }
    return { n, counts };
  };
  return {
    pattern: { all: hist(20, 11, 4) },
    numbers: { all: hist(20, 10, 4.5) },
    rotation: { all: hist(20, 12, 4) },
    memory: { all: hist(9, 5, 1.3) },
  };
}
