import { instruments, personalityShort } from '@anabokra/content';
import { describe, expect, it } from 'vitest';

import { CORE_TASKS, DISCOVER_TASKS, EASY_FIRST, discoverPlan, discoverStatus, interestsSettled } from './discover-plan';
import { gameStepId } from './games';

describe('Discover plan', () => {
  const plan = discoverPlan();
  const all = plan.flatMap((t) => t.items);

  it('has 10 tasks, each with one interest card per type', () => {
    expect(plan).toHaveLength(DISCOVER_TASKS);
    for (const t of plan) {
      expect(t.items.length).toBeGreaterThanOrEqual(6);
      expect(t.items.length).toBeLessThanOrEqual(11);
      const types = t.items
        .filter((i) => i.instrumentId === 'interests')
        .map((i) => instruments.interests.items.find((x) => x.id === i.id)!)
        .filter((i) => !i.attentionCheck)
        .map((i) => i.scale)
        .sort();
      expect(types).toEqual(['A', 'C', 'E', 'I', 'R', 'S']);
    }
  });

  it('asks every interest, the short personality set and every strength exactly once', () => {
    const ids = all.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id.startsWith('ip_')).sort()).toEqual(instruments.interests.items.map((i) => i.id).sort());
    expect(all.filter((i) => i.instrumentId === 'personality').map((i) => i.id).sort()).toEqual(personalityShort().items.map((i) => i.id).sort());
    expect(all.filter((i) => i.instrumentId === 'abilities').map((i) => i.id).sort()).toEqual(instruments.abilities.selfRatings.map((i) => i.id).sort());
  });

  it('mixes formats in tasks 1–8 and keeps tasks 9–10 to interest cards (and games in the core)', () => {
    for (const t of plan.slice(0, CORE_TASKS)) expect(new Set(t.items.map((i) => i.format)).size).toBe(3);
    for (const t of plan.slice(CORE_TASKS)) {
      expect(t.items.every((i) => i.instrumentId === 'interests')).toBe(true);
      expect(t.game).toBeUndefined();
    }
    expect(plan.flatMap((t) => t.items).filter((i) => i.id === 'ip_ac1')).toHaveLength(1);
  });

  it('opens with everyday cards and leaves the specialised ones for last', () => {
    for (const [type, ids] of Object.entries(EASY_FIRST)) {
      const items = instruments.interests.items.filter((i) => i.scale === type).map((i) => i.id);
      expect([...ids].sort()).toEqual(items.sort());
    }
    const interestIds = (n: number) => plan[n - 1]!.items.filter((i) => i.instrumentId === 'interests').map((i) => i.id);
    expect(interestIds(1).sort()).toEqual(Object.values(EASY_FIRST).map((ids) => ids[0]).sort());
    // Every card that needs an explanation sits in the second half.
    const hinted = instruments.interests.items.filter((i) => i.hint).map((i) => i.id);
    expect(hinted.length).toBeGreaterThan(10);
    for (const id of hinted) expect(plan.findIndex((t) => t.items.some((i) => i.id === id))).toBeGreaterThanOrEqual(4);
    expect(interestIds(10)).toContain('ip_E01');
  });

  it('reports which tasks are done and the next one', () => {
    expect(discoverStatus(new Set())).toEqual({ done: Array(10).fill(false), optional: Array(10).fill(false), doneCount: 0, required: 10, next: 1 });
    const first = new Set(plan[0]!.items.map((i) => i.id));
    expect(discoverStatus(first)).toMatchObject({ doneCount: 1, next: 2 });
    // Tasks with a game aren't done until it's played.
    const questions = new Set(all.map((i) => i.id));
    expect(discoverStatus(questions)).toMatchObject({ doneCount: 5, next: 3 });
    const games = plan.flatMap((t) => (t.game ? [gameStepId(t.game)] : []));
    expect(games).toEqual(['game_pattern', 'game_numbers', 'game_patience', 'game_rotation', 'game_memory']);
    expect(discoverStatus(new Set([...questions, ...games]))).toMatchObject({ doneCount: 10, next: null });
    // Once a result exists, games are extras: a Discover finished before them stays finished.
    expect(discoverStatus(questions, { gamesRequired: false })).toMatchObject({ doneCount: 10, next: null });
  });

  it('makes tasks 9–10 a bonus once the top three interest types are settled', () => {
    const core = new Set([...plan.slice(0, CORE_TASKS).flatMap((t) => t.items.map((i) => i.id)), ...plan.flatMap((t) => (t.game ? [gameStepId(t.game)] : []))]);
    expect(discoverStatus(core)).toMatchObject({ doneCount: 8, next: 9 });
    expect(discoverStatus(core, { settled: true })).toMatchObject({ doneCount: 8, required: 8, next: null, optional: [...Array(8).fill(false), true, true] });
  });
});

describe('interestsSettled', () => {
  const coreInterests = discoverPlan()
    .slice(0, CORE_TASKS)
    .flatMap((t) => t.items.filter((i) => i.instrumentId === 'interests' && i.id !== 'ip_ac1'));
  const answers = (value: (type: string) => number) =>
    Object.fromEntries(coreInterests.map((i) => [i.id, value(instruments.interests.items.find((x) => x.id === i.id)!.scale!)]));

  it('is settled when the top three lead by more than the cards left could change', () => {
    // Checklist: I, A, S tapped every time, the rest never.
    expect(interestsSettled(answers((t) => (['I', 'A', 'S'].includes(t) ? 5 : 1)))).toBe(true);
  });

  it('is not settled while the gap is small, or before every type can be scored', () => {
    expect(interestsSettled(answers((t) => (['I', 'A', 'S'].includes(t) ? 4 : 3)))).toBe(false);
    const partial = Object.fromEntries(Object.entries(answers(() => 5)).slice(0, 20));
    expect(interestsSettled(partial)).toBe(false);
  });
});
