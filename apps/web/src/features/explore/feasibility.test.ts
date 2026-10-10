import type { MinScore } from '@anabokra/content';
import { describe, expect, it } from 'vitest';

import { assessFeasibility, cutoffPct, FEASIBILITY, latestCutoffs } from './feasibility';

const cut = (year: number, track: string, scorePct: number, scoreRaw?: number, scoreMax?: number): MinScore => ({
  year, track, scorePct, scoreRaw, scoreMax, system: 'thanaweya-amma', kind: 'tansik-phase1-cutoff', sourceUrl: `https://x/${year}`,
});
const minimum = (year: number, track: string, scorePct: number): MinScore => ({ year, track, scorePct, system: 'thanaweya-amma', kind: 'regulatory-minimum', sourceUrl: 'https://x/min' });

describe('latestCutoffs', () => {
  it('takes the latest year per track and compares by percent across the 410 and 320 scales', () => {
    const c = latestCutoffs([cut(2024, 'science', 94.39, 387, 410), cut(2025, 'science', 94.84, 303.5, 320), cut(2023, 'math', 90, 369, 410)]);
    const sci = c.find((x) => x.track === 'science')!;
    expect(sci).toMatchObject({ year: 2025, pct: 94.84, max: 320, raw: 303.5 });
    expect(c.find((x) => x.track === 'math')).toMatchObject({ year: 2023, max: 410 });
  });
  it('derives the percent from raw/max when scorePct is missing', () => {
    expect(cutoffPct({ kind: 'tansik-phase1-cutoff', scorePct: NaN, scoreRaw: 288, scoreMax: 320 })).toBe(90);
    expect(cutoffPct({ kind: 'tansik-phase1-cutoff', scorePct: NaN, scoreRaw: 369, scoreMax: 410 })).toBe(90);
  });
  it('never treats a regulatory minimum as a cutoff', () => {
    expect(cutoffPct(minimum(2025, 'science', 79))).toBeNull();
    expect(latestCutoffs([minimum(2025, 'science', 79)])).toEqual([]);
    const mixed = latestCutoffs([cut(2024, 'science', 85, 349, 410), minimum(2025, 'science', 99)]);
    expect(mixed).toHaveLength(1);
    expect(mixed[0]!.pct).toBe(85);
  });
});

describe('assessFeasibility', () => {
  const cutoffs = latestCutoffs([cut(2025, 'science', 90, 288, 320)]);
  const run = (expected: number | null, track: string | null = 'science', accepted = ['science']) => assessFeasibility(cutoffs, accepted, { expectedScorePct: expected, track });

  it('exposes the thresholds in one constant', () => {
    expect(FEASIBILITY).toEqual({ LIKELY_MARGIN_PTS: 2, REACH_BELOW_PTS: 2 });
  });
  it('likely at cutoff + 2 or more', () => {
    expect(run(92).status).toBe('likely');
    expect(run(99).status).toBe('likely');
  });
  it('reach from 2 below up to just under 2 above', () => {
    expect(run(91.99).status).toBe('reach');
    expect(run(90).status).toBe('reach');
    expect(run(88).status).toBe('reach');
  });
  it('unlikely below cutoff - 2', () => {
    expect(run(87.99).status).toBe('unlikely');
  });
  it('is unknown without a score, a cutoff, or an accepted track', () => {
    expect(run(null)).toMatchObject({ status: 'unknown', reason: 'no_score' });
    expect(assessFeasibility([], ['science'], { expectedScorePct: 95, track: 'science' })).toMatchObject({ status: 'unknown', reason: 'no_cutoff' });
    expect(run(95, 'literary')).toMatchObject({ status: 'unknown', reason: 'track_mismatch' });
  });
  it('a program with only a regulatory minimum is unknown, whatever the score', () => {
    const only = latestCutoffs([minimum(2025, 'science', 79)]);
    expect(assessFeasibility(only, ['science'], { expectedScorePct: 99, track: 'science' })).toMatchObject({ status: 'unknown', reason: 'no_cutoff' });
  });
  it('uses the strictest cutoff when the track is unknown', () => {
    const c = latestCutoffs([cut(2025, 'science', 90), cut(2025, 'math', 95)]);
    expect(assessFeasibility(c, ['science', 'math'], { expectedScorePct: 93, track: null }).status).toBe('reach');
  });
});
