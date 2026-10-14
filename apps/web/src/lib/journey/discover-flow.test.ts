import { describe, expect, it } from 'vitest';

import { DeviceStore } from '@/lib/local/device';
import { MemoryKv } from '@/lib/local/kv';
import { localRuntimeFor } from '@/lib/local/runtime';

import { paths } from '@anabokra/content';

import { demoStations } from '@/lib/local/demo-answers';

import { sampleNorms } from '@/features/games/score';

import { discoverPlan } from './discover-plan';
import { DISCOVER_GAMES, saveGame } from './games';
import { maybeFinalize } from './journey';
import { readJourney, saveVerifyAnswer, saveVerifyResult, scoreVerify } from './verify';

/** A student who loves investigating and building: I and R high, the rest middling. */
function answer(id: string, format: string): number {
  if (id === 'ip_ac1') return 5;
  if (format !== 'swipe') return 4;
  if (id.startsWith('ip_I') || id.startsWith('ip_R')) return 5;
  if (id.startsWith('ip_S') || id.startsWith('ip_E')) return 2;
  return 3;
}

async function runtime() {
  const kv = new MemoryKv();
  const device = new DeviceStore(kv);
  let profile = await device.createProfile({ mode: 'phone', ageBand: '21-25', locale: 'en' });
  profile = await device.setConsent(profile.id, { basis: 'adult_self', textVersion: 't', policyVersion: 'p' });
  return localRuntimeFor(kv, profile);
}

describe('Discover on the phone', () => {
  it('goes from nothing, to an early guess after task 4, to suggested paths after task 8', async () => {
    const rt = await runtime();
    const { session } = await rt.service.startSession(rt.userId, {});
    const stages: string[] = [];
    for (const task of discoverPlan()) {
      for (const item of task.items)
        await rt.service.saveResponses(rt.userId, { sessionId: session.id, station: item.instrumentId, responses: [{ itemId: item.id, value: answer(item.id, item.format), ms: 2500 }] });
      stages.push((await rt.service.preview(rt.userId, { sessionId: session.id })).stage);
    }
    expect(stages).toEqual(['none', 'none', 'none', 'early', 'early', 'early', 'early', 'suggested', 'suggested', 'suggested']);

    const final = await rt.service.preview(rt.userId, { sessionId: session.id });
    expect(final.personalitySet).toBe('short');
    expect(final.flat).toBe(false);
    expect(final.interestCode.slice(0, 2).sort()).toEqual(['I', 'R']);
    expect(final.groups).toHaveLength(12);
    // Someone who loves investigating and building should see engineering, tech or science near the top.
    expect(final.groups.slice(0, 3).map((g) => g.cluster).some((c) => ['engineering', 'tech', 'science'].includes(c))).toBe(true);
  });

  it('says no path stands out when every interest answer is the same', async () => {
    const rt = await runtime();
    const { session } = await rt.service.startSession(rt.userId, {});
    for (const item of discoverPlan().flatMap((t) => t.items))
      await rt.service.saveResponses(rt.userId, { sessionId: session.id, station: item.instrumentId, responses: [{ itemId: item.id, value: item.id === 'ip_ac1' ? 5 : 4, ms: 2500 }] });
    const p = await rt.service.preview(rt.userId, { sessionId: session.id });
    expect(p.stage).toBe('suggested');
    expect(p.flat).toBe(true);
  });

  it('makes a result from Discover alone, scoring personality from the short set', async () => {
    const rt = await runtime();
    const { session } = await rt.service.startSession(rt.userId, {});
    for (const item of discoverPlan().flatMap((t) => t.items))
      await rt.service.saveResponses(rt.userId, { sessionId: session.id, station: item.instrumentId, responses: [{ itemId: item.id, value: answer(item.id, item.format), ms: 2500 }] });
    const result = await rt.service.finalize(rt.userId, { sessionId: session.id });
    const derived = (result.scores as { derived: { personalitySet?: string; scoredStations: string[] } }).derived;
    expect(derived.personalitySet).toBe('short');
    expect(derived.scoredStations).toEqual(['interests', 'personality', 'abilities']);
  });
});

describe('the first full result', () => {
  it('is made only once Discover, values and a first path are done', async () => {
    const rt = await runtime();
    const { session } = await rt.service.startSession(rt.userId, {});
    const d = { rt, sessionId: session.id };
    const quiet = { send: async () => {} };
    for (const item of discoverPlan().flatMap((t) => t.items))
      await rt.service.saveResponses(rt.userId, { sessionId: session.id, station: item.instrumentId, responses: [{ itemId: item.id, value: answer(item.id, item.format), ms: 2500 }] });
    expect(await maybeFinalize(d, quiet)).toBe(false);

    const values = demoStations().find(([s]) => s === 'values')![1];
    await rt.service.saveResponses(rt.userId, { sessionId: session.id, station: 'values', responses: values });
    await rt.service.completeStation(rt.userId, { sessionId: session.id, station: 'values', valuesRanking: ['achievement', 'independence', 'recognition', 'relationships', 'support', 'workingConditions'] });
    expect(await maybeFinalize(d, quiet)).toBe(false);

    const preview = await rt.service.preview(rt.userId, { sessionId: session.id });
    const tech = paths.tech!;
    await saveVerifyAnswer(rt.device.kv, rt.userId, 'tech', 'tech_day_1', 3);
    const answers = (await readJourney(rt.device.kv, rt.userId)).paths.tech!.answers;
    await saveVerifyResult(rt.device.kv, rt.userId, scoreVerify(tech, answers, { groupFit: preview.groups.find((g) => g.cluster === 'tech')!.fit, careerFits: preview.fits }));
    // Discover isn't finished until its games are played.
    expect(await maybeFinalize(d, quiet)).toBe(false);

    // Play the five games; with enough players to compare against, the logic game counts.
    await rt.device.kv.set('games:norms', { at: Date.now(), norms: sampleNorms() });
    for (const game of Object.values(DISCOVER_GAMES)) await saveGame(rt.device.kv, rt.userId, game, { at: new Date().toISOString(), points: 15, shown: 6, of: 8 });
    expect(await maybeFinalize(d, quiet)).toBe(true);

    const result = await rt.service.getLatestResult(rt.userId);
    const derived = (result!.scores as { derived: { scoredStations: string[]; personalitySet: string; abilityBasis: Record<string, string>; gameStandings: Record<string, number> } }).derived;
    expect(derived.scoredStations).toEqual(['interests', 'personality', 'values', 'abilities']);
    expect(derived.personalitySet).toBe('short');
    expect(derived.abilityBasis).toMatchObject({ logical: 'performance+self', numerical: 'performance+self', spatial: 'performance+self', verbal: 'self' });
    expect(derived.gameStandings.logical).toBeGreaterThan(0.5);
    expect(await maybeFinalize(d, quiet)).toBe(false);
  });
});

