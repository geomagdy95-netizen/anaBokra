import type { MinScore, Program } from '@anabokra/content';

/**
 * The most recent minimum score of a program: latest year wins; within a year a Tansik phase-1 cut-off
 * beats the Ministry's regulatory floor for private universities. Null when nothing is published.
 */
export function latestMinScore(program: Pick<Program, 'minScores'>): MinScore | null {
  const rank = (m: MinScore) => (m.kind === 'tansik-phase1-cutoff' ? 1 : 0);
  let best: MinScore | null = null;
  for (const m of program.minScores) {
    if (!best || m.year > best.year || (m.year === best.year && rank(m) > rank(best))) best = m;
  }
  return best;
}
