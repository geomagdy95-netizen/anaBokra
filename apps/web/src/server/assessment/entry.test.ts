import { instruments } from '@anabokra/content';
import { describe, expect, it } from 'vitest';

import { MemoryAssessmentRepo } from './memory-repo';
import { RETAKE_AFTER_DAYS, retakeStatus } from './retake';
import { createAssessmentService } from './service';

const USER = 'a0000000-0000-4000-8000-000000000001';
const OTHER = 'a0000000-0000-4000-8000-000000000002';
const DAY = 86_400_000;

function setup() {
  let t = Date.parse('2026-01-01T10:00:00Z');
  const now = () => new Date(t);
  const repo = new MemoryAssessmentRepo({ now });
  repo.addUser(USER);
  repo.addUser(OTHER);
  return { repo, svc: createAssessmentService({ repo, now }), advance: (ms: number) => void (t += ms) };
}

async function finishInterests(svc: ReturnType<typeof setup>['svc'], userId: string) {
  const { session } = await svc.startSession(userId, { kind: 'full', locale: 'en' });
  const responses = instruments.interests.items.map((it, i) => ({
    itemId: it.id,
    value: it.attentionCheck ? it.attentionCheck.expected : 1 + ((i * 7) % 5),
  }));
  await svc.saveResponses(userId, { sessionId: session.id, station: 'interests', responses });
  await svc.finalize(userId, { sessionId: session.id });
  return session.id;
}

describe('retakeStatus', () => {
  it('uses 182 days', () => expect(RETAKE_AFTER_DAYS).toBe(182));
  const done = '2026-01-01T00:00:00.000Z';
  it('is locked before 182 days and reports the unlock date', () => {
    const r = retakeStatus(done, new Date(Date.parse(done) + 181 * DAY));
    expect(r).toEqual({ allowed: false, unlocksAt: new Date(Date.parse(done) + 182 * DAY).toISOString() });
  });
  it('is allowed from day 182', () => {
    expect(retakeStatus(done, new Date(Date.parse(done) + 182 * DAY))).toEqual({ allowed: true });
    expect(retakeStatus(done, new Date(Date.parse(done) + 400 * DAY))).toEqual({ allowed: true });
  });
});

describe('getEntryState / getLatestResult', () => {
  it('is "new" with no sessions and no results, and starts nothing', async () => {
    const { svc, repo } = setup();
    expect(await svc.getEntryState(USER)).toEqual({ kind: 'new' });
    expect(await svc.getLatestResult(USER)).toBeNull();
    expect(await repo.findOpenSession(USER, 'full')).toBeNull();
  });

  it('is "open" while a session is in progress', async () => {
    const { svc } = setup();
    await svc.startSession(USER, { kind: 'full', locale: 'en' });
    expect(await svc.getEntryState(USER)).toEqual({ kind: 'open' });
  });

  it('after finalize shows results (no new session) with the retake lock date', async () => {
    const { svc, repo, advance } = setup();
    const sid = await finishInterests(svc, USER);
    advance(10 * DAY);
    const st = await svc.getEntryState(USER);
    expect(st.kind).toBe('results');
    if (st.kind !== 'results') return;
    expect(st.sessionId).toBe(sid);
    expect(st.retake.allowed).toBe(false);
    expect(await repo.findOpenSession(USER, 'full')).toBeNull();
    expect((await svc.getLatestResult(USER))?.sessionId).toBe(sid);
  });

  it('offers retake once 182 days have passed, and the new session then becomes "open"', async () => {
    const { svc, advance } = setup();
    await finishInterests(svc, USER);
    advance(RETAKE_AFTER_DAYS * DAY);
    const st = await svc.getEntryState(USER);
    expect(st.kind === 'results' && st.retake.allowed).toBe(true);
    await svc.startSession(USER, { kind: 'full', locale: 'en' });
    expect(await svc.getEntryState(USER)).toEqual({ kind: 'open' });
  });

  it('returns the most recent result and never another user\'s', async () => {
    const { svc, advance } = setup();
    await finishInterests(svc, USER);
    advance(RETAKE_AFTER_DAYS * DAY);
    const second = await finishInterests(svc, USER);
    expect((await svc.getLatestResult(USER))?.sessionId).toBe(second);
    expect(await svc.getLatestResult(OTHER)).toBeNull();
  });
});
