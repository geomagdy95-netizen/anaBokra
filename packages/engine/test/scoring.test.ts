import { describe, expect, it } from 'vitest';
import {
  checkQuality,
  cronbachAlpha,
  interestProfile,
  normalCdf,
  scoreAbilities,
  scoreLikert,
  scoreValueBudget,
  scoreValues,
  type LikertResult,
} from '../src';
import { abilitiesInstrument, likert, valuesInstrument } from './fixtures';

describe('scoreLikert', () => {
  it('applies reverse keys and normalizes to 0..1', () => {
    const r = scoreLikert(likert, [
      { itemId: 'a1', value: 5 },
      { itemId: 'a2', value: 1 }, // reverse keyed → 5
      { itemId: 'b1', value: 3 },
    ]);
    expect(r.scales.a).toMatchObject({ raw: 5, normalized: 1, answered: 2, expected: 2 });
    expect(r.scales.b?.normalized).toBe(0.5);
    expect(r.complete).toBe(true);
  });

  it('excludes attention checks from scoring', () => {
    const r = scoreLikert(likert, [
      { itemId: 'a1', value: 1 },
      { itemId: 'a2', value: 5 },
      { itemId: 'b1', value: 1 },
      { itemId: 'ac', value: 5 },
    ]);
    expect(r.scales.a?.raw).toBe(1);
  });

  it('can score an early guess at a lower coverage, but never from no answers', () => {
    const early = scoreLikert(likert, [{ itemId: 'a1', value: 4 }], undefined, { minCoverage: 0.3 });
    expect(early.scales.a?.answered).toBe(1);
    expect(early.scales.b).toBeUndefined();
    expect(scoreLikert(likert, [], undefined, { minCoverage: 0 }).scales).toEqual({});
  });

  it('skips scales below 80% coverage and marks the result incomplete', () => {
    const r = scoreLikert(likert, [{ itemId: 'a1', value: 4 }, { itemId: 'b1', value: 4 }]);
    expect(r.scales.a).toBeUndefined();
    expect(r.scales.b).toBeDefined();
    expect(r.complete).toBe(false);
  });

  it('adds norm-based percentiles when norms are supplied', () => {
    const r = scoreLikert(likert, [{ itemId: 'b1', value: 4 }, { itemId: 'a1', value: 3 }, { itemId: 'a2', value: 3 }], {
      version: 'n1',
      group: 'eg-15-18',
      scales: { b: { mean: 3, sd: 1 } },
    });
    expect(r.scales.b?.percentile).toBeCloseTo(0.8413, 3);
    expect(r.scales.a?.percentile).toBeUndefined();
    expect(r.normsVersion).toBe('n1');
  });

  it('rejects out-of-range answers', () => {
    expect(() => scoreLikert(likert, [{ itemId: 'a1', value: 7 }])).toThrow(RangeError);
  });
});

describe('interestProfile', () => {
  const result = (s: Record<string, number>): LikertResult => ({
    instrumentId: 'interests',
    version: '1',
    complete: true,
    scales: Object.fromEntries(
      Object.entries(s).map(([k, v]) => [k, { raw: 1 + v * 4, normalized: v, answered: 10, expected: 10 }]),
    ),
  });

  it('returns the Holland code, differentiation and consistency', () => {
    const p = interestProfile(result({ R: 0.2, I: 0.9, A: 0.8, S: 0.4, E: 0.1, C: 0.3 }))!;
    expect(p.code).toBe('IAS');
    expect(p.differentiation).toBeCloseTo(0.8);
    expect(p.consistency).toBe(3); // I and A are adjacent on the hexagon
  });

  it('scores opposite top types as low consistency', () => {
    expect(interestProfile(result({ R: 0.9, I: 0.1, A: 0.1, S: 0.8, E: 0.1, C: 0.1 }))!.consistency).toBe(1);
  });

  it('returns undefined when a type is missing', () => {
    expect(interestProfile(result({ R: 0.5 }))).toBeUndefined();
  });
});

describe('scoreValues', () => {
  it('maps buckets to 0..1 and ranks values, honoring an explicit final ranking', () => {
    const placements = {
      c_ach: 'must',
      c_wc: 'no',
      c_rec: 'nice',
      c_rel: 'must',
      c_sup: 'no',
      c_ind: 'nice',
    } as const;
    const r = scoreValues(valuesInstrument, placements)!;
    expect(r.scores.achievement).toBe(1);
    expect(r.scores.recognition).toBe(0.5);
    expect(r.scores.support).toBe(0);
    expect(r.ranking.slice(0, 2)).toEqual(['achievement', 'relationships']);
    expect(scoreValues(valuesInstrument, placements, ['relationships'])!.ranking[0]).toBe('relationships');
  });

  it('returns undefined until every card is placed', () => {
    expect(scoreValues(valuesInstrument, { c_ach: 'must' })).toBeUndefined();
  });
});

describe('scoreValueBudget', () => {
  const coins = { b_ach: 4, b_wc: 0, b_rec: 2, b_rel: 4, b_sup: 1, b_ind: 1 };

  it('scores each value against an even spread (even = 0.5, double or more = 1)', () => {
    const r = scoreValueBudget(valuesInstrument, coins)!;
    expect(r.scores.achievement).toBe(1);
    expect(r.scores.recognition).toBe(0.5);
    expect(r.scores.workingConditions).toBe(0);
    expect(r.scores.support).toBe(0.25);
    expect(r.ranking.slice(0, 3)).toEqual(['achievement', 'relationships', 'recognition']);
    expect(scoreValueBudget(valuesInstrument, coins, ['relationships'])!.ranking[0]).toBe('relationships');
  });

  it('needs an answer for every value and at least one coin spent', () => {
    expect(scoreValueBudget(valuesInstrument, { b_ach: 12 })).toBeUndefined();
    expect(scoreValueBudget(valuesInstrument, { b_ach: 0, b_wc: 0, b_rec: 0, b_rel: 0, b_sup: 0, b_ind: 0 })).toBeUndefined();
    expect(scoreValueBudget({ ...valuesInstrument, budget: undefined }, coins)).toBeUndefined();
  });
});

describe('scoreAbilities', () => {
  const allSelf = (v: number) => abilitiesInstrument.selfRatings.map((s) => ({ itemId: s.id, value: v }));

  it('uses self-ratings when no performance items were attempted', () => {
    const r = scoreAbilities(abilitiesInstrument, allSelf(4), [])!;
    expect(r.scores.verbal).toBe(0.75);
    expect(r.basis.numerical).toBe('self');
  });

  it('blends performance and self-ratings, counting skipped items as wrong', () => {
    const r = scoreAbilities(abilitiesInstrument, allSelf(3), [
      { itemId: 'p1', choice: 2 },
      { itemId: 'p2', choice: null },
    ])!;
    // performance 1/2 = 0.5, self 0.5 → 0.5
    expect(r.scores.numerical).toBeCloseTo(0.5);
    expect(r.basis.numerical).toBe('performance+self');
  });

  it('uses a game standing among other players as the measured part', () => {
    const w = abilitiesInstrument.performanceWeight;
    // Rated themselves middling (0.5) but scored above 90% of players at the logic game.
    const r = scoreAbilities(abilitiesInstrument, allSelf(3), [], undefined, { logical: 0.9 })!;
    expect(r.scores.logical).toBeCloseTo(w * 0.9 + (1 - w) * 0.5);
    expect(r.basis.logical).toBe('performance+self');
    expect(r.basis.verbal).toBe('self');
  });
});

describe('checkQuality', () => {
  it('flags straight-lining, rushing and failed attention checks', () => {
    const responses = Array.from({ length: 20 }, (_, i) => ({ itemId: `x${i}`, value: 3, ms: 400 }));
    const report = checkQuality(likert, [...responses, { itemId: 'ac', value: 1 }]);
    expect(report.flags).toEqual(expect.arrayContaining(['straightLining', 'lowVariance', 'tooFast', 'attentionFailed']));
    expect(report.attentionChecks).toEqual({ total: 1, passed: 0 });
  });

  it('passes a varied, unhurried session', () => {
    const responses = Array.from({ length: 20 }, (_, i) => ({ itemId: `x${i}`, value: (i % 5) + 1, ms: 3000 }));
    expect(checkQuality(likert, [...responses, { itemId: 'ac', value: 5 }]).flags).toEqual([]);
  });
});

describe('stats', () => {
  it('normalCdf matches known values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1)).toBeCloseTo(0.1587, 3);
  });

  it('cronbachAlpha is 1 for perfectly consistent items and null for no variance', () => {
    expect(cronbachAlpha([[1, 1], [3, 3], [5, 5]])).toBeCloseTo(1);
    expect(cronbachAlpha([[2, 2], [2, 2]])).toBeNull();
  });
});
