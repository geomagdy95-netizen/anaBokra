import { instruments, personalityShort } from '@anabokra/content';
import { describe, expect, it } from 'vitest';

import { DISCOVER_TASKS, discoverPlan, discoverStatus } from './discover-plan';
import { gameStepId } from './games';

describe('Discover plan', () => {
  const plan = discoverPlan();
  const all = plan.flatMap((t) => t.items);

  it('has 10 tasks of 9–10 questions, each with one interest card per type', () => {
    expect(plan).toHaveLength(DISCOVER_TASKS);
    for (const t of plan) {
      expect(t.items.length).toBeGreaterThanOrEqual(9);
      expect(t.items.length).toBeLessThanOrEqual(10);
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

  it('mixes formats inside every task', () => {
    for (const t of plan) expect(new Set(t.items.map((i) => i.format)).size).toBe(3);
    expect(plan.flatMap((t) => t.items).filter((i) => i.id === 'ip_ac1')).toHaveLength(1);
  });

  it('reports which tasks are done and the next one', () => {
    expect(discoverStatus(new Set())).toEqual({ done: Array(10).fill(false), doneCount: 0, next: 1 });
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
});
