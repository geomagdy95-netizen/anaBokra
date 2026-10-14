import { describe, expect, it } from 'vitest';

import type { Preview } from '@/server/assessment/scoring';

import { paths } from '@anabokra/content';

import { coreGrowth, islandStates } from './map-state';

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

  it('starts with only my island: no field on the map before suggestions', () => {
    const s = islandStates(preview('none'), { v: 1, paths: {} });
    expect(Object.values(s).every((x) => x.visible === false && x.slot === undefined)).toBe(true);
  });

  it('puts the 3 suggestions on the map, then fields the user adds or starts, in that order', () => {
    const s = islandStates(preview('suggested'), { v: 1, paths: { health: { answers: { health_day_1: 3 } } }, added: ['law'] });
    expect(['tech', 'science', 'engineering', 'law', 'health'].map((id) => s[id as keyof typeof s].slot)).toEqual([0, 1, 2, 3, 4]);
    expect(s.media).toMatchObject({ visible: false, relation: 'other' });
  });

  it('keeps a field the user took off the map off it, and closes the gap', () => {
    const s = islandStates(preview('suggested'), { v: 1, paths: {}, hidden: ['science'], added: ['law'] });
    expect(s.science).toMatchObject({ relation: 'suggested', visible: false });
    expect([s.tech.slot, s.engineering.slot, s.law.slot]).toEqual([0, 1, 2]);
  });

  it('suggests nothing when interests are flat', () => {
    const s = islandStates(preview('suggested', true), { v: 1, paths: {} });
    expect(Object.values(s).some((x) => x.relation === 'suggested')).toBe(false);
  });
});

describe('island growth', () => {
  it('grows with Verify tasks and is full, with a flag, once the path is checked', () => {
    const fresh = islandStates(preview('suggested'), { v: 1, paths: {} });
    expect(fresh.tech).toMatchObject({ growth: 0, checked: false });
    const tech = paths.tech!;
    const day = tech.tasks.find((t) => t.kind === 'story')!;
    const half = islandStates(preview('suggested'), { v: 1, paths: { tech: { answers: Object.fromEntries(day.items.map((i) => [i.id, 2])) } } });
    expect(half.tech!.growth).toBeCloseTo(0.25);
    const done = islandStates(preview('suggested'), { v: 1, paths: { tech: { answers: {}, result: { band: 'fitsWell' } as never } } });
    expect(done.tech).toMatchObject({ growth: 1, checked: true });
  });

  it('grows the core one step per Discover task', () => {
    expect(coreGrowth(0)).toBe(0);
    expect(coreGrowth(5)).toBe(0.5);
    expect(coreGrowth(12)).toBe(1);
  });
});
