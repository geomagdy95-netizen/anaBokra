import { describe, expect, it } from 'vitest';

import { checkPath } from '@/lib/journey/test-paths';
import { LINK_CODE, normalizeEventCode } from '@/lib/research';
import { MemoryEventStore, type PilotEvent } from '@/server/research/events';
import { ResearchFailure, ResearchService } from '@/server/research/service';
import { MemoryResearchStore } from '@/server/research/store';

import { demoStations } from './demo-answers';
import { DeviceStore, type AgeBand, type ConsentBasis } from './device';
import { MemoryKv } from './kv';
import { researchKey, stopResearch, syncResearch, type ResearchState } from './research';
import { localRuntimeFor } from './runtime';
import { exportProfile, importProfile } from './transfer';

const NOW = Date.UTC(2026, 10, 20, 10);
const READY = { rd_01: 4, rd_02: 3, rd_03: 2, rd_04: 4, rd_05: 3, rd_06: 2 };

function server(events: PilotEvent[] = [{ code: 'CU-FCI-1', partner: 'Cairo FCI', research: true, opensOn: null, closesOn: null }]) {
  const store = new MemoryResearchStore();
  const svc = new ResearchService(new MemoryEventStore(events), store, () => NOW);
  // The phone's uploads go straight into the real service, as the routes would.
  const post = async (path: string, body: unknown) => {
    try {
      if (path.endsWith('/answers')) await svc.submitAnswerSet(body, 'ip');
      else if (path.endsWith('/readiness')) await svc.submitReadiness(body, 'ip');
      else if (path.endsWith('/paths')) await svc.submitPathSet(body, 'ip');
      else await svc.forget(body, 'ip');
      return true;
    } catch {
      return false;
    }
  };
  return { svc, store, post };
}

async function phone({ research = true, event = true, ageBand = '21-25' as AgeBand, basis = 'adult_self' as ConsentBasis } = {}) {
  const kv = new MemoryKv();
  const device = new DeviceStore(kv);
  let profile = await device.createProfile({ mode: 'phone', ageBand, locale: 'ar' });
  profile = await device.setConsent(profile.id, { basis, textVersion: 't', policyVersion: 'p', research });
  if (event) profile = await device.updateProfile(profile.id, { event: { code: 'CU-FCI-1', research: true, joinedAt: 'x' } });
  await device.setActiveId(profile.id);
  const rt = localRuntimeFor(kv, profile);
  const { session } = await rt.service.startSession(rt.userId, {});
  await rt.service.saveContext(rt.userId, { sessionId: session.id, context: { stage: 'university', field: 'law', year: 2 } });
  for (const [station, responses] of demoStations()) {
    await rt.service.saveResponses(rt.userId, { sessionId: session.id, station, responses });
    await rt.service.completeStation(rt.userId, { sessionId: session.id, station });
  }
  const result = await rt.service.finalize(rt.userId, { sessionId: session.id });
  await rt.service.saveReadiness(rt.userId, { phase: 'post', sessionId: session.id, answers: READY });
  return { kv, rt, profile, result };
}

describe('session codes', () => {
  it('normalizes what people type', () => {
    expect(normalizeEventCode(' cu fci 1 ')).toBe('CU-FCI-1');
    expect(normalizeEventCode('cu-fci-١')).toBe('CU-FCI-1');
    expect(normalizeEventCode('x')).toBeNull();
    expect(normalizeEventCode('<script>')).toBeNull();
  });

  it('checks codes against the partner list and its dates, and limits guessing', async () => {
    const { svc } = server([
      { code: 'CU-FCI-1', partner: 'Cairo FCI', research: true, opensOn: '2026-11-15', closesOn: '2026-12-10' },
      { code: 'AUC-1', partner: 'AUC', research: false, opensOn: null, closesOn: '2026-11-01' },
    ]);
    expect(await svc.checkEvent('cu-fci-1', 'a')).toEqual({ code: 'CU-FCI-1', research: true });
    await expect(svc.checkEvent('NOPE-1', 'a')).rejects.toMatchObject({ code: 'unknown_event' });
    await expect(svc.checkEvent('AUC-1', 'a')).rejects.toMatchObject({ code: 'event_closed' });
    await expect(svc.checkEvent('??', 'a')).rejects.toMatchObject({ code: 'invalid' });
    for (let i = 0; i < 20; i++) await svc.checkEvent('NOPE-2', 'b').catch(() => {});
    await expect(svc.checkEvent('CU-FCI-1', 'b')).rejects.toMatchObject({ code: 'rate_limited' });
  });
});

describe('research uploads from the phone', () => {
  it('sends one anonymous answer set and the readiness record with the link code, once', async () => {
    const { store, post } = server();
    const { rt } = await phone();
    expect(await syncResearch(rt, post)).toBe('sent');
    expect(await syncResearch(rt, post)).toBe('skipped');

    expect(store.answerSets).toHaveLength(1);
    const set = store.answerSets[0]!;
    expect(set).toMatchObject({ eventCode: 'CU-FCI-1', ageBand: '21-25', stage: 'university', locale: 'ar', receivedWeek: '2026-W47' });
    expect(Object.keys(set.answers).sort()).toEqual(['abilities', 'interests', 'personality', 'values']);
    // Nothing that could link it to the readiness record, the device or the person.
    const text = JSON.stringify(set);
    const state = (await rt.device.kv.get<ResearchState>(researchKey(rt.userId)))!;
    expect(text).not.toContain(state.linkCode);
    expect(text).not.toContain(rt.userId);
    expect(text).not.toMatch(/law|"year"|sessionId|createdAt|takenAt/);

    expect(store.readiness).toHaveLength(1);
    expect(store.readiness[0]).toMatchObject({ linkCode: state.linkCode, phase: 'post', eventCode: 'CU-FCI-1', answers: READY });
    expect(state.linkCode).toMatch(LINK_CODE);
  });

  it('sends nothing without the opt-in, without a session, or for 15–17', async () => {
    const { store, post } = server();
    for (const opts of [{ research: false }, { event: false }, { ageBand: '15-17' as AgeBand, basis: 'guardian_verified' as ConsentBasis }]) {
      const { rt } = await phone(opts);
      expect(await syncResearch(rt, post)).toBe('skipped');
    }
    expect(store.answerSets).toHaveLength(0);
    expect(store.readiness).toHaveLength(0);
  });

  it('is refused by the server when the partner does not offer research', async () => {
    const { svc } = server([{ code: 'CU-FCI-1', partner: 'x', research: false, opensOn: null, closesOn: null }]);
    const { rt } = await phone();
    let refused: unknown = null;
    await syncResearch(rt, async (path, body) => {
      await (path.endsWith('/answers') ? svc.submitAnswerSet(body, 'ip') : svc.submitReadiness(body, 'ip')).catch((e) => (refused = e));
      return false;
    });
    expect(refused).toBeInstanceOf(ResearchFailure);
    expect((refused as ResearchFailure).code).toBe('research_not_offered');
  });

  it('rejects made-up items, values or extra fields', async () => {
    const { svc } = server();
    const base = { v: 1, eventCode: 'CU-FCI-1', ageBand: '21-25', stage: null, locale: 'en', versions: {}, valuesRanking: [] };
    await expect(svc.submitAnswerSet({ ...base, answers: { interests: { nope_99: 3 } } }, 'ip')).rejects.toMatchObject({ code: 'invalid' });
    await expect(svc.submitAnswerSet({ ...base, answers: {}, name: 'Sara' }, 'ip')).rejects.toMatchObject({ code: 'invalid' });
    await expect(svc.submitAnswerSet({ ...base, ageBand: '15-17', answers: {} }, 'ip')).rejects.toMatchObject({ code: 'invalid' });
    const rd = { v: 1, eventCode: 'CU-FCI-1', linkCode: 'A'.repeat(26), phase: 'pre', version: '1.0.0-draft', locale: 'en' };
    await expect(svc.submitReadiness({ ...rd, answers: { ...READY, rd_01: 9 } }, 'ip')).rejects.toMatchObject({ code: 'invalid' });
    await expect(svc.submitReadiness({ ...rd, answers: { rd_01: 3 } }, 'ip')).rejects.toMatchObject({ code: 'invalid' });
  });

  it('stops after the research deletion date', async () => {
    const store = new MemoryResearchStore();
    const late = new ResearchService(new MemoryEventStore([{ code: 'CU-FCI-1', partner: 'x', research: true, opensOn: null, closesOn: null }]), store, () => Date.UTC(2027, 5, 18));
    const rd = { v: 1, eventCode: 'CU-FCI-1', linkCode: 'A'.repeat(26), phase: 'pre', version: '1.0.0-draft', locale: 'en', answers: READY };
    await expect(late.submitReadiness(rd, 'ip')).rejects.toMatchObject({ code: 'research_ended' });
  });

  it('turning research off deletes the readiness records sent from this phone, and starts a new link code', async () => {
    const { store, post } = server();
    const { rt } = await phone();
    await syncResearch(rt, post);
    const first = (await rt.device.kv.get<ResearchState>(researchKey(rt.userId)))!.linkCode;

    expect(await stopResearch(rt, async () => false)).toEqual({ deleted: false, hadReadiness: true });
    expect(store.readiness).toHaveLength(1);
    expect(await syncResearch(rt, post)).toBe('skipped');

    expect(await stopResearch(rt, post)).toEqual({ deleted: true, hadReadiness: true });
    expect(store.readiness).toHaveLength(0);
    expect(store.answerSets).toHaveLength(1);
    expect((await rt.device.getProfile(rt.userId))?.consent?.research).toBe(false);
    expect(await rt.device.kv.get(researchKey(rt.userId))).toBeUndefined();

    const p = (await rt.device.getProfile(rt.userId))!;
    await rt.device.updateProfile(rt.userId, { consent: { ...p.consent!, research: true } });
    await syncResearch(rt, post);
    const second = (await rt.device.kv.get<ResearchState>(researchKey(rt.userId)))!.linkCode;
    expect(second).not.toBe(first);
  });

  it('moves the link code and what was sent to a new phone, so nothing is sent twice', async () => {
    const { store, post } = server();
    const { kv, rt, profile } = await phone();
    await syncResearch(rt, post);
    const bundle = await exportProfile(kv, profile.id);

    const other = new MemoryKv();
    await importProfile(other, structuredClone(bundle));
    const moved = localRuntimeFor(other, (await new DeviceStore(other).getProfile(profile.id))!);
    expect(await syncResearch(moved, post)).toBe('skipped');
    expect(store.answerSets).toHaveLength(1);
    expect((await other.get<ResearchState>(researchKey(profile.id)))?.linkCode).toBe(
      (await kv.get<ResearchState>(researchKey(profile.id)))?.linkCode,
    );
  });
});

describe('checked paths in research', () => {
  it("sends each checked path's answers once, with no key", async () => {
    const { store, post } = server();
    const { kv, rt, profile } = await phone();
    const tech = await checkPath(kv, profile.id, 'tech');
    expect(await syncResearch(rt, post)).toBe('sent');
    expect(store.pathSets).toHaveLength(1);
    expect(store.pathSets[0]).toMatchObject({ eventCode: 'CU-FCI-1', ageBand: '21-25', stage: 'university', pathId: 'tech', answers: tech.answers, band: tech.result.band, components: tech.result.components });
    const state = (await kv.get<ResearchState>(researchKey(profile.id)))!;
    expect(JSON.stringify(store.pathSets)).not.toContain(state.linkCode);
    expect(state.sentPaths).toEqual(['tech']);

    expect(await syncResearch(rt, post)).toBe('skipped');
    await checkPath(kv, profile.id, 'health');
    await syncResearch(rt, post);
    expect(store.pathSets.map((p) => p.pathId)).toEqual(['tech', 'health']);
  });

  it('rejects answers that are not items of that path, or values the item does not allow', async () => {
    const { svc } = server();
    const { kv, profile } = await phone();
    const { answers, result } = await checkPath(kv, profile.id, 'tech');
    const ok = { v: 1, eventCode: 'CU-FCI-1', ageBand: '21-25', stage: null, locale: 'ar', pathId: 'tech', version: result.version, answers, components: result.components, band: result.band };
    await expect(svc.submitPathSet(ok, 'ip')).resolves.toBeUndefined();
    await expect(svc.submitPathSet({ ...ok, answers: { ...answers, tech_day_1: 7 } }, 'ip')).rejects.toMatchObject({ code: 'invalid' });
    await expect(svc.submitPathSet({ ...ok, answers: { health_day_1: 2 } }, 'ip')).rejects.toMatchObject({ code: 'invalid' });
    await expect(svc.submitPathSet({ ...ok, pathId: 'law' }, 'ip')).rejects.toMatchObject({ code: 'invalid' });
    await expect(svc.submitPathSet({ ...ok, linkCode: 'x' }, 'ip')).rejects.toMatchObject({ code: 'invalid' });
  });
});
