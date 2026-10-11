import { describe, expect, it } from 'vitest';

import { buildStatsSummary, statsSummarySchema } from '@/lib/stats-summary';
import { isoWeek } from '@/server/stats/store';
import { StatsFailure, StatsService } from '@/server/stats/service';
import { MemoryStatsStore } from '@/server/stats/store';

import { demoStations } from './demo-answers';
import { DeviceStore } from './device';
import { MemoryKv } from './kv';
import { localRuntimeFor } from './runtime';
import { statsKey, syncStats } from './stats';

async function finished({ stats, context }: { stats: boolean; context?: Record<string, unknown> }) {
  const kv = new MemoryKv();
  const device = new DeviceStore(kv);
  let profile = await device.createProfile({ mode: 'phone', ageBand: '18-20', locale: 'ar' });
  profile = await device.setConsent(profile.id, { basis: 'adult_self', textVersion: 't', policyVersion: 'p', stats });
  const rt = localRuntimeFor(kv, profile);
  const { session } = await rt.service.startSession(rt.userId, {});
  for (const [station, responses] of demoStations()) {
    await rt.service.saveResponses(rt.userId, { sessionId: session.id, station, responses });
    await rt.service.completeStation(rt.userId, { sessionId: session.id, station });
  }
  if (context) await rt.service.saveContext(rt.userId, { sessionId: session.id, context });
  const result = await rt.service.finalize(rt.userId, { sessionId: session.id });
  return { kv, rt, result, profile };
}

describe('anonymous statistics summary', () => {
  it('is coarse and carries nothing identifying', async () => {
    const { rt, result, profile } = await finished({ stats: true });
    const latest = (await rt.service.getLatestResult(rt.userId))!;
    const s = buildStatsSummary({ result: { scores: latest.scores, matches: latest.matches }, ageBand: '18-20', stage: null, locale: 'ar' });
    expect(s.completion).toBe(4);
    expect(s.topInterests).toHaveLength(3);
    expect(s.topGroups.length).toBeGreaterThan(0);
    expect(Object.values(s.bands.interests).every((b) => ['low', 'mid', 'high'].includes(b))).toBe(true);
    const text = JSON.stringify(s);
    for (const secret of [profile.id, result.sessionId, latest.id, latest.createdAt]) expect(text).not.toContain(secret);
    expect(text).not.toMatch(/\d\.\d{3}/); // no raw scores
  });

  it('rejects extra or malformed fields', () => {
    const ok = { v: 1, ageBand: '21-25', stage: null, locale: 'en', completion: 4, topInterests: ['I'], topGroups: ['tech'], topValues: [], bands: { interests: {}, personality: {}, abilities: {} }, eventCode: null };
    expect(statsSummarySchema.safeParse(ok).success).toBe(true);
    expect(statsSummarySchema.safeParse({ ...ok, userId: 'x' }).success).toBe(false);
    expect(statsSummarySchema.safeParse({ ...ok, ageBand: 'under15' }).success).toBe(false);
    expect(statsSummarySchema.safeParse({ ...ok, bands: { ...ok.bands, interests: { I: 0.71 } } }).success).toBe(false);
  });
});

describe('sending', () => {
  it('sends once per result, only with opt-in', async () => {
    const posted: unknown[] = [];
    const post = async (s: unknown) => (posted.push(s), true);
    const yes = await finished({ stats: true });
    expect(await syncStats(yes.rt, post)).toBe('sent');
    expect(await syncStats(yes.rt, post)).toBe('skipped');
    expect(posted).toHaveLength(1);
    expect(await yes.kv.get(statsKey(yes.profile.id))).toEqual([yes.result.id]);

    const no = await finished({ stats: false });
    expect(await syncStats(no.rt, post)).toBe('skipped');
    expect(posted).toHaveLength(1);
  });

  it('sends the stage from the context station, and only the stage', async () => {
    const { rt } = await finished({ stats: true, context: { stage: 'university', field: 'computing', year: 2 } });
    const posted: unknown[] = [];
    await syncStats(rt, async (s) => (posted.push(s), true));
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ stage: 'university' });
    expect(JSON.stringify(posted[0])).not.toMatch(/computing|"year"/);
  });

  it('retries after a failed send', async () => {
    const { rt } = await finished({ stats: true });
    expect(await syncStats(rt, async () => false)).toBe('failed');
    expect(await syncStats(rt, async () => true)).toBe('sent');
  });

  it('forgets what was sent when the profile is deleted', async () => {
    const { kv, rt, profile } = await finished({ stats: true });
    await syncStats(rt, async () => true);
    await new DeviceStore(kv).deleteProfile(profile.id);
    expect(await kv.get(statsKey(profile.id))).toBeUndefined();
  });
});

describe('stats service', () => {
  it('stores a valid summary with only the week it arrived, and rate-limits', async () => {
    const store = new MemoryStatsStore();
    const svc = new StatsService(store, () => Date.UTC(2026, 9, 11, 13, 45), 1);
    const summary = { v: 1, ageBand: '15-17', stage: 'school', locale: 'ar', completion: 2, topInterests: ['S'], topGroups: [], topValues: [], bands: { interests: { S: 'high' }, personality: {}, abilities: {} }, eventCode: null };
    await svc.submit(summary, 'ip');
    expect(store.records).toEqual([{ ...summary, receivedWeek: '2026-W41' }]);
    await expect(svc.submit(summary, 'ip')).rejects.toMatchObject({ code: 'rate_limited' });
    await expect(svc.submit({ hello: 1 }, 'other')).rejects.toBeInstanceOf(StatsFailure);
  });

  it('computes ISO weeks across year boundaries', () => {
    expect(isoWeek(new Date(Date.UTC(2026, 0, 1)))).toBe('2026-W01');
    expect(isoWeek(new Date(Date.UTC(2027, 0, 1)))).toBe('2026-W53');
    expect(isoWeek(new Date(Date.UTC(2026, 11, 28)))).toBe('2026-W53');
  });
});

describe('overlapping syncs', () => {
  it('sends once when called twice at the same time', async () => {
    const { rt } = await finished({ stats: true });
    let calls = 0;
    const post = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 10));
      return true;
    };
    const [a, b] = await Promise.all([syncStats(rt, post), syncStats(rt, post)]);
    expect(calls).toBe(1);
    expect([a, b]).toEqual(['sent', 'sent']);
    expect(await syncStats(rt, post)).toBe('skipped');
  });
});
