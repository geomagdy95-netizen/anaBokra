import { describe, expect, it } from 'vitest';

import { DeviceStore } from '@/lib/local/device';
import { MemoryKv } from '@/lib/local/kv';
import { localRuntimeFor } from '@/lib/local/runtime';

import { discoverPlan } from './discover-plan';

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
