import { describe, expect, it } from 'vitest';

import { AssessmentError, type AssessmentErrorCode } from '@/server/assessment/errors';

import { assessmentKey } from './assessment-repo';
import { demoStations as stations } from './demo-answers';
import { DeviceStore, type LocalProfile } from './device';
import { MemoryKv } from './kv';
import { localRuntimeFor } from './runtime';

function clock() {
  let t = Date.parse('2026-11-22T08:00:00Z');
  return () => new Date((t += 1000));
}

async function setup({ consent = true } = {}) {
  const kv = new MemoryKv();
  const now = clock();
  const device = new DeviceStore(kv, now);
  let profile = await device.createProfile({ mode: 'phone', ageBand: '18-20', locale: 'ar' });
  if (consent) profile = await device.setConsent(profile.id, { basis: 'adult_self', textVersion: 'consent-0.3-draft', policyVersion: '0.3' });
  await device.setActiveId(profile.id);
  return { kv, now, device, profile, rt: localRuntimeFor(kv, profile, now) };
}

async function code(p: Promise<unknown>): Promise<AssessmentErrorCode | 'no_error'> {
  try {
    await p;
    return 'no_error';
  } catch (e) {
    if (e instanceof AssessmentError) return e.code;
    throw e;
  }
}

async function answerAll(rt: Awaited<ReturnType<typeof setup>>['rt'], sessionId: string) {
  for (const [station, responses] of stations()) {
    await rt.service.saveResponses(rt.userId, { sessionId, station, responses });
    await rt.service.completeStation(rt.userId, { sessionId, station });
  }
}

describe('assessment on the device', () => {
  it('runs a full assessment and scores it on the device', async () => {
    const { rt } = await setup();
    const { session } = await rt.service.startSession(rt.userId, { locale: 'ar' });
    await answerAll(rt, session.id);
    const result = await rt.service.finalize(rt.userId, { sessionId: session.id });
    expect(result.coverage).toBeGreaterThan(0.9);
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('keeps everything across a reload (a new runtime over the same store)', async () => {
    const { kv, now, rt, profile } = await setup();
    const { session } = await rt.service.startSession(rt.userId, {});
    await answerAll(rt, session.id);
    const first = await rt.service.finalize(rt.userId, { sessionId: session.id });

    const reloaded = localRuntimeFor(kv, profile, now);
    const latest = await reloaded.service.getLatestResult(reloaded.userId);
    expect(latest?.sessionId).toBe(first.sessionId);
    expect((await reloaded.service.getEntryState(reloaded.userId)).kind).not.toBe('open');
  });

  it('resumes an unfinished session where it stopped', async () => {
    const { kv, now, rt, profile } = await setup();
    const { session } = await rt.service.startSession(rt.userId, {});
    const [, interests] = stations()[0];
    await rt.service.saveResponses(rt.userId, { sessionId: session.id, station: 'interests', responses: interests.slice(0, 12), cursor: { index: 12 } });

    const again = await localRuntimeFor(kv, profile, now).service.startSession(profile.id, {});
    expect(again.resumed).toBe(true);
    expect(again.progress.stations[0]).toMatchObject({ answered: 12, done: false });
    expect(again.progress.cursor).toEqual({ index: 12 });
  });

  it('does not save overlapping writes over each other', async () => {
    const { kv, now, rt, profile } = await setup();
    const { session } = await rt.service.startSession(rt.userId, {});
    const [, interests] = stations()[0];
    await Promise.all([
      rt.service.saveResponses(rt.userId, { sessionId: session.id, station: 'interests', responses: interests.slice(0, 20) }),
      rt.service.saveResponses(rt.userId, { sessionId: session.id, station: 'interests', responses: interests.slice(20, 40) }),
    ]);
    const resume = await localRuntimeFor(kv, profile, now).service.getResume(profile.id, { sessionId: session.id });
    expect(resume.responses).toHaveLength(40);
  });

  it('refuses to start before the user has accepted, and starts after', async () => {
    const { rt, device, profile } = await setup({ consent: false });
    expect(await code(rt.service.startSession(rt.userId, {}))).toBe('consent_required');
    await device.setConsent(profile.id, { basis: 'adult_self', textVersion: 'consent-0.3-draft', policyVersion: '0.3' });
    expect(await code(rt.service.startSession(rt.userId, {}))).toBe('no_error');
  });

  it('keeps profiles on one shared device apart', async () => {
    const { kv, now, device, rt } = await setup();
    const other: LocalProfile = await device.setConsent(
      (await device.createProfile({ mode: 'shared', ageBand: '21-25' })).id,
      { basis: 'adult_self', textVersion: 'consent-0.3-draft', policyVersion: '0.3' },
    );
    const { session } = await rt.service.startSession(rt.userId, {});
    const ort = localRuntimeFor(kv, other, now);
    expect(await code(ort.service.getProgress(other.id, { sessionId: session.id }))).toBe('not_found');
    expect((await ort.service.startSession(other.id, {})).session.id).not.toBe(session.id);
  });

  it('deletes a profile and everything stored for it', async () => {
    const { kv, device, rt, profile } = await setup();
    const { session } = await rt.service.startSession(rt.userId, {});
    await answerAll(rt, session.id);
    await rt.service.finalize(rt.userId, { sessionId: session.id });
    expect(await kv.get(assessmentKey(profile.id))).toBeDefined();

    await device.deleteProfile(profile.id);
    expect(await kv.get(assessmentKey(profile.id))).toBeUndefined();
    expect(await device.getProfile(profile.id)).toBeNull();
    expect(await device.getActiveId()).toBeNull();
  });

  it('wipes the whole device', async () => {
    const { kv, device } = await setup();
    await device.createProfile({ mode: 'shared' });
    await device.wipeAll();
    expect(await kv.keys()).toEqual([]);
  });
});

describe('parent PIN', () => {
  it('stores only a salted hash and checks it', async () => {
    const { hashPin, verifyPin, isValidPin } = await import('./pin');
    const h = await hashPin('4821', 1000);
    expect(JSON.stringify(h)).not.toContain('4821');
    expect(await verifyPin('4821', h)).toBe(true);
    expect(await verifyPin('4822', h)).toBe(false);
    expect((await hashPin('4821', 1000)).hash).not.toBe(h.hash);
    expect([isValidPin('123'), isValidPin('1234'), isValidPin('123456'), isValidPin('12a4')]).toEqual([false, true, true, false]);
  });
});
