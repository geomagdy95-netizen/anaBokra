import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEIGHTS,
  abilitiesFit,
  contextFlags,
  interestFit,
  matchCareer,
  personalityFit,
  rankCareers,
  surprisingMatches,
  valuesFit,
  type UserProfile,
} from '../src';
import { career } from './fixtures';

const investigative = { R: 0.3, I: 0.95, A: 0.5, S: 0.4, E: 0.2, C: 0.3 };

describe('interestFit', () => {
  it('is high for a matching profile shape and low for the opposite', () => {
    const scientist = career('scientist', [2.5, 6.8, 3.5, 3, 2, 3]);
    const sales = career('sales', [2, 1.5, 3, 4, 6.5, 4]);
    expect(interestFit(investigative, scientist)!).toBeGreaterThan(0.9);
    expect(interestFit(investigative, sales)!).toBeLessThan(0.3);
  });

  it('returns neutral 0.5 for a flat (undifferentiated) profile', () => {
    const flat = { R: 0.5, I: 0.5, A: 0.5, S: 0.5, E: 0.5, C: 0.5 };
    expect(interestFit(flat, career('c', [1, 7, 1, 1, 1, 1]))).toBe(0.5);
  });

  it('returns undefined when the user has no interest scores', () => {
    expect(interestFit(undefined, career('c', [1, 7, 1, 1, 1, 1]))).toBeUndefined();
  });
});

describe('personalityFit', () => {
  it('rewards high scores on relevant traits and ignores irrelevant ones', () => {
    const c = career('c', [1, 1, 1, 1, 1, 1]);
    c.traits.personality = { extraversion: 0, agreeableness: 0, conscientiousness: 0.9, emotionalStability: 0, intellect: 0 };
    const user = { extraversion: 0.1, agreeableness: 0.1, conscientiousness: 0.8, emotionalStability: 0.1, intellect: 0.1 };
    expect(personalityFit(user, c)).toBeCloseTo(0.8);
  });

  it('rewards low scores on traits with negative relevance', () => {
    const c = career('c', [1, 1, 1, 1, 1, 1]);
    c.traits.personality = { extraversion: -0.6, agreeableness: 0, conscientiousness: 0, emotionalStability: 0, intellect: 0 };
    const user = { extraversion: 0.2, agreeableness: 0.5, conscientiousness: 0.5, emotionalStability: 0.5, intellect: 0.5 };
    expect(personalityFit(user, c)).toBeCloseTo(0.8);
  });
});

describe('valuesFit', () => {
  it('weights the career supply of each value by how much the user values it', () => {
    const c = career('c', [1, 1, 1, 1, 1, 1]);
    c.traits.values = { achievement: 1, workingConditions: 0, recognition: 0, relationships: 0, support: 0, independence: 0 };
    const user = { achievement: 1, workingConditions: 0, recognition: 0, relationships: 0, support: 0, independence: 0 };
    expect(valuesFit(user, c)).toBe(1);
    expect(valuesFit({ ...user, achievement: 0, relationships: 1 }, c)).toBe(0);
  });
});

describe('abilitiesFit', () => {
  it('does not penalize meeting or exceeding requirements, and penalizes large gaps', () => {
    const c = career('c', [1, 1, 1, 1, 1, 1]);
    c.traits.abilities.numerical = { level: 0.9, importance: 1 };
    const strong = { verbal: 0.9, numerical: 0.95, logical: 0.9, spatial: 0.9, creative: 0.9, manual: 0.9 };
    expect(abilitiesFit(strong, c)).toBe(1);
    expect(abilitiesFit({ ...strong, numerical: 0.1 }, c)!).toBeLessThan(0.85);
  });
});

describe('matchCareer', () => {
  it('renormalizes weights over available components and reports coverage', () => {
    const m = matchCareer({ interests: investigative }, career('sci', [2.5, 6.8, 3.5, 3, 2, 3]));
    expect(m.coverage).toBeCloseTo(DEFAULT_WEIGHTS.interests);
    expect(m.fit).toBe(m.components.interests);
  });

  it('explains matches with shared interest types', () => {
    const m = matchCareer({ interests: investigative }, career('sci', [2.5, 6.8, 3.5, 3, 2, 3]));
    expect(m.reasons[0]).toMatchObject({ kind: 'interest', types: expect.arrayContaining(['I']) });
  });

  it('adds ability-gap watch-outs', () => {
    const c = career('c', [1, 7, 1, 1, 1, 1]);
    c.traits.abilities.numerical = { level: 0.9, importance: 0.9 };
    const user: UserProfile = {
      abilities: { verbal: 0.5, numerical: 0.3, logical: 0.5, spatial: 0.5, creative: 0.5, manual: 0.5 },
    };
    expect(matchCareer(user, c).watchOuts).toContainEqual({ kind: 'abilityGap', domain: 'numerical', gap: expect.closeTo(0.6) });
  });
});

describe('contextFlags', () => {
  const c = { ...career('med', [1, 7, 1, 5, 1, 1]), egypt: { tracks: ['science'], typicalMinScorePct: 95, costLevel: 'high' as const } };

  it('flags track mismatch, reach scores and cost without excluding the career', () => {
    expect(contextFlags({ curriculum: 'thanaweya', track: 'literary', expectedScorePct: 88, budget: 'low' }, c)).toEqual([
      'trackMismatch',
      'scoreReach',
      'costHigh',
    ]);
    expect(contextFlags({ curriculum: 'thanaweya', track: 'science', expectedScorePct: 97, budget: 'high' }, c)).toEqual([]);
  });

  it('ignores track rules for non-Thanaweya curricula', () => {
    expect(contextFlags({ curriculum: 'igcse', track: 'literary' }, c)).toEqual([]);
  });
});

describe('rankCareers & surprisingMatches', () => {
  const list = [
    career('lab', [2, 6.5, 2, 3, 1.5, 3], 'science'),
    career('doc', [2, 6, 2, 5, 2, 2], 'health'),
    career('chem', [3, 6.4, 2, 2, 2, 3.5], 'science'),
    career('bio', [2.5, 6.6, 2.5, 3, 1.5, 2.5], 'science'),
    career('eng', [4, 6, 2, 2, 2.5, 3], 'engineering'),
    career('writer', [1, 5, 6.5, 3, 2, 1.5], 'creative'),
    career('sales', [2, 1.5, 3, 4, 6.5, 4], 'business'),
  ];

  it('sorts by fit, highest first', () => {
    const ranked = rankCareers({ interests: investigative }, list);
    expect(ranked.map((m) => m.fit)).toEqual([...ranked.map((m) => m.fit)].sort((a, b) => b - a));
    expect(ranked.at(-1)!.careerId).toBe('sales');
  });

  it('surfaces strong fits from clusters outside the top results', () => {
    const ranked = rankCareers({ interests: investigative }, list);
    const surprising = surprisingMatches(ranked, { top: 3, within: 40 });
    const topClusters = new Set(ranked.slice(0, 3).map((m) => m.cluster));
    expect(surprising.length).toBeGreaterThan(0);
    for (const m of surprising) expect(topClusters.has(m.cluster)).toBe(false);
  });
});
