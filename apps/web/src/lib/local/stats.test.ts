import { describe, expect, it } from 'vitest';

import { checkPath } from '@/lib/journey/test-paths';
import { saveGame } from '@/lib/journey/games';
import { saveRating } from '@/lib/journey/verify';
import { buildStatsSummary, statsSummarySchema, statsUploadSchema } from '@/lib/stats-summary';
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

describe('checked paths and the results rating', () => {
  it('sends one record per checked path and one rating, once each, with nothing identifying', async () => {
    const { kv, rt, profile, result } = await finished({ stats: true, context: { stage: 'university' } });
    await checkPath(kv, profile.id, 'tech');
    await checkPath(kv, profile.id, 'health');
    await saveRating(kv, profile.id, 4);
    const posted: Record<string, unknown>[] = [];
    const post = async (s: unknown) => (posted.push(s as Record<string, unknown>), true);
    expect(await syncStats(rt, post)).toBe('sent');
    expect(posted.map((p) => p.kind ?? 'summary')).toEqual(['summary', 'path', 'path', 'rating']);
    expect(posted.filter((p) => p.kind === 'path').map((p) => p.group)).toEqual(['tech', 'health']);
    expect(posted.find((p) => p.kind === 'rating')).toEqual({ v: 1, kind: 'rating', rating: 4, ageBand: '18-20', stage: 'university', locale: 'ar', eventCode: null });
    for (const p of posted) expect(statsUploadSchema.safeParse(p).success).toBe(true);
    const text = JSON.stringify(posted);
    for (const secret of [profile.id, result.sessionId, result.id]) expect(text).not.toContain(secret);
    expect(text).not.toMatch(/"fit"|"at"|"answers"|"components"/);

    expect(await syncStats(rt, post)).toBe('skipped');
    await checkPath(kv, profile.id, 'business');
    expect(await syncStats(rt, post)).toBe('sent');
    expect(posted).toHaveLength(5);
  });

  it('sends a path checked again only once, and nothing without the opt-in', async () => {
    const yes = await finished({ stats: true });
    await checkPath(yes.kv, yes.profile.id, 'tech');
    const posted: unknown[] = [];
    await syncStats(yes.rt, async (s) => (posted.push(s), true));
    await checkPath(yes.kv, yes.profile.id, 'tech');
    expect(await syncStats(yes.rt, async (s) => (posted.push(s), true))).toBe('skipped');
    expect(posted).toHaveLength(2);

    const no = await finished({ stats: false });
    await checkPath(no.kv, no.profile.id, 'tech');
    await saveRating(no.kv, no.profile.id, 5);
    expect(await syncStats(no.rt, async () => true)).toBe('skipped');
  });

  it('keeps going after one failed record and retries it later', async () => {
    const { kv, rt, profile } = await finished({ stats: true });
    await checkPath(kv, profile.id, 'tech');
    await saveRating(kv, profile.id, 3);
    const posted: Record<string, unknown>[] = [];
    expect(await syncStats(rt, async (s) => ((s as { kind?: string }).kind === 'path' ? false : (posted.push(s as Record<string, unknown>), true)))).toBe('failed');
    expect(posted.map((p) => p.kind ?? 'summary')).toEqual(['summary', 'rating']);
    expect(await syncStats(rt, async (s) => (posted.push(s as Record<string, unknown>), true))).toBe('sent');
    expect(posted.map((p) => p.kind ?? 'summary')).toEqual(['summary', 'rating', 'path']);
  });

  it('rejects malformed path and rating records', () => {
    const sender = { v: 1, ageBand: '21-25', stage: null, locale: 'en', eventCode: 'CU-FCI-1' };
    expect(statsUploadSchema.safeParse({ ...sender, kind: 'path', group: 'tech', band: 'fitsWell' }).success).toBe(true);
    expect(statsUploadSchema.safeParse({ ...sender, kind: 'path', group: 'tech', band: 'great' }).success).toBe(false);
    expect(statsUploadSchema.safeParse({ ...sender, kind: 'path', group: 'tech', band: 'fitsWell', fit: 0.7 }).success).toBe(false);
    expect(statsUploadSchema.safeParse({ ...sender, kind: 'rating', rating: 5 }).success).toBe(true);
    for (const rating of [0, 6, 3.5]) expect(statsUploadSchema.safeParse({ ...sender, kind: 'rating', rating }).success).toBe(false);
    expect(statsUploadSchema.safeParse({ ...sender, kind: 'rating', rating: 4, group: 'tech' }).success).toBe(false);
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

  it('stores path and rating records as they came, with the week', async () => {
    const store = new MemoryStatsStore();
    const svc = new StatsService(store, () => Date.UTC(2026, 10, 20, 9));
    const sender = { v: 1, ageBand: '18-20', stage: 'university', locale: 'ar', eventCode: 'CU-FCI-1' } as const;
    await svc.submit({ ...sender, kind: 'path', group: 'health', band: 'fitsPartly' }, 'ip');
    await svc.submit({ ...sender, kind: 'rating', rating: 5 }, 'ip');
    expect(store.records).toEqual([
      { ...sender, kind: 'path', group: 'health', band: 'fitsPartly', receivedWeek: '2026-W47' },
      { ...sender, kind: 'rating', rating: 5, receivedWeek: '2026-W47' },
    ]);
  });

  it('sends the first score of each ranked game once, with the opt-in, and never patience', async () => {
    const { rt } = await finished({ stats: true });
    await saveGame(rt.device.kv, rt.userId, 'pattern', { at: '2026-10-15T10:00:00Z', points: 13, shown: 6, of: 8 });
    await saveGame(rt.device.kv, rt.userId, 'patience', { at: '2026-10-15T10:00:00Z', points: 0, shown: 3, of: 6 });
    const sent: unknown[] = [];
    await syncStats(rt, async (u) => (sent.push(u), true));
    await syncStats(rt, async (u) => (sent.push(u), true));
    const games = sent.filter((u) => (u as { kind?: string }).kind === 'game');
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ v: 1, ageBand: '18-20', locale: 'ar', kind: 'game', game: 'pattern', gameVersion: 1, score: 13 });
  });

  it('stores game scores and turns them into a score spread per game and age band', async () => {
    const store = new MemoryStatsStore();
    const svc = new StatsService(store, () => Date.UTC(2026, 9, 15, 9));
    const sender = { v: 1 as const, stage: null, locale: 'ar' as const, eventCode: null };
    await svc.submit({ ...sender, ageBand: '18-20', kind: 'game', game: 'pattern', gameVersion: 1, score: 12 }, 'ip');
    await svc.submit({ ...sender, ageBand: '18-20', kind: 'game', game: 'pattern', gameVersion: 1, score: 12 }, 'ip');
    await svc.submit({ ...sender, ageBand: '21-25', kind: 'game', game: 'pattern', gameVersion: 1, score: 3 }, 'ip');
    const norms = await svc.norms();
    expect(norms.pattern?.['18-20']).toEqual({ n: 2, counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2] });
    expect(norms.pattern?.all?.n).toBe(3);
    expect(norms.pattern?.all?.counts[3]).toBe(1);
    expect(statsUploadSchema.safeParse({ ...sender, ageBand: '18-20', kind: 'game', game: 'pattern', gameVersion: 1, score: 12, nickname: 'x' }).success).toBe(false);
    expect(statsUploadSchema.safeParse({ ...sender, ageBand: '18-20', kind: 'game', game: 'patience', gameVersion: 1, score: 3 }).success).toBe(false);
    expect(statsUploadSchema.safeParse({ ...sender, ageBand: '18-20', kind: 'game', game: 'pattern', gameVersion: 1, score: 21 }).success).toBe(false);
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
