// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { cleanFeedbackText, statsUploadSchema } from '@/lib/stats-summary';

import { demoStations } from './demo-answers';
import { DeviceStore } from './device';
import { MemoryKv } from './kv';
import { localRuntimeFor } from './runtime';
import { journeySteps, syncStats } from './stats';
import { track, trackView, viewedCareers } from './usage';

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


describe('journey milestones, career views and usage', () => {
  it('derives each milestone once from what the phone stores', () => {
    const steps = journeySteps(
      { v: 1, paths: { tech: { answers: { a: 1 } } }, careers: { pharmacist: { answers: { day: 3 }, result: {} as never } }, selectedCareers: ['pharmacist'], situation: { budget: 'public', at: '' } },
      { discover: { done: [true, true, false], next: 3, doneCount: 2, required: 8 }, hasResult: true },
    );
    expect(steps.map((s) => s.key)).toEqual([
      'step:discover_task:1',
      'step:discover_task:2',
      'step:results_viewed',
      'step:path_started:tech',
      'step:quest_started:pharmacist',
      'step:quest_done:pharmacist',
      'step:career_chosen:pharmacist',
      'step:situation_answered',
    ]);
  });

  it('sends milestones, career views and a finished day of usage with the opt-in only, and valid', async () => {
    window.localStorage.clear();
    trackView('pharmacist');
    track('dock_results', new Date('2026-10-10T10:00:00Z'));
    const { rt } = await finished({ stats: true });
    const posted: Record<string, unknown>[] = [];
    await syncStats(rt, async (s) => (posted.push(s as Record<string, unknown>), true), { discover: { done: [true], next: 2, doneCount: 1, required: 8 }, hasResult: true });
    expect(posted.find((p) => p.kind === 'view')).toMatchObject({ kind: 'view', career: 'pharmacist' });
    expect(posted.find((p) => p.kind === 'usage')).toMatchObject({ kind: 'usage', counts: { dock_results: 1 } });
    expect(posted.filter((p) => p.kind === 'step').map((p) => p.step)).toEqual(['discover_task', 'results_viewed']);
    for (const p of posted) expect(statsUploadSchema.safeParse(p).success).toBe(true);

    trackView('nurse');
    const no = await finished({ stats: false });
    expect(await syncStats(no.rt, async () => true)).toBe('skipped');
    expect(viewedCareers()).toEqual([]);
  });

  it('cleans feedback text of e-mails, links, handles and phone numbers', () => {
    expect(cleanFeedbackText('call me 0101 234 5678 or ٠١٠١٢٣٤٥٦٧٨, mail a.b@x.com, see https://x.y/z @me_99 ok')).toBe('call me […] or […], mail […], see […] […] ok');
    expect(cleanFeedbackText('   ')).toBeNull();
    expect(cleanFeedbackText('x'.repeat(600))).toHaveLength(500);
  });
});
