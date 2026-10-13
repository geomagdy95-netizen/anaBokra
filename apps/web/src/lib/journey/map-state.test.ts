import { describe, expect, it } from 'vitest';

import type { Preview } from '@/server/assessment/scoring';

import { islandStates } from './map-state';

const preview = (stage: Preview['stage'], flat = false): Preview => ({
  stage,
  flat,
  groups: ['tech', 'science', 'engineering', 'health'].map((cluster, i) => ({ cluster, fit: 80 - i * 5, careerIds: [] })),
  matches: [],
  fits: {},
  interestCode: [],
  personalitySet: null,
});

describe('island states from progress', () => {
  it('keeps every path neutral before suggestions', () => {
    const s = islandStates(preview('none'), { v: 1, paths: {} });
    expect(Object.values(s).every((x) => x.relation === 'neutral' && x.bridge === 'connected')).toBe(true);
  });

  it('marks the early guess as updating, then suggested; started paths as added; the rest open', () => {
    const journey = { v: 1 as const, paths: { health: { answers: { health_day_1: 3 } } } };
    const early = islandStates(preview('early'), journey);
    expect(early.tech).toMatchObject({ relation: 'suggested', bridge: 'updating' });
    const s = islandStates(preview('suggested'), journey);
    expect(s.tech).toMatchObject({ relation: 'suggested', bridge: 'connected', total: 3, done: 0 });
    expect(s.health).toMatchObject({ relation: 'added', bridge: 'connected' });
    expect(s.law).toMatchObject({ relation: 'other', bridge: 'broken' });
  });

  it('shows a path the user added to their map as added, even untouched', () => {
    const s = islandStates(preview('suggested'), { v: 1, paths: {}, added: ['law'] });
    expect(s.law).toMatchObject({ relation: 'added', bridge: 'connected' });
    expect(s.media).toMatchObject({ relation: 'other', bridge: 'broken' });
  });

  it('suggests nothing when interests are flat', () => {
    const s = islandStates(preview('suggested', true), { v: 1, paths: {} });
    expect(Object.values(s).some((x) => x.relation === 'suggested')).toBe(false);
  });
});
