import { describe, expect, it } from 'vitest';

import { StatsService } from './service';
import { MemoryStatsStore } from './store';

const sender = { v: 1 as const, ageBand: '18-20' as const, stage: 'university' as const, locale: 'ar' as const, eventCode: 'UNI-1' };

describe('insights from anonymous records', () => {
  it('cleans feedback again on arrival and adds up milestones, views, usage and feedback', async () => {
    const store = new MemoryStatsStore();
    const svc = new StatsService(store, () => Date.parse('2026-10-16T10:00:00Z'));
    for (let i = 0; i < 3; i++) await svc.submit({ ...sender, kind: 'step', step: 'discover_task', n: 1, group: null, career: null }, 'ip');
    await svc.submit({ ...sender, kind: 'step', step: 'discover_task', n: 2, group: null, career: null }, 'ip');
    await svc.submit({ ...sender, kind: 'view', career: 'pharmacist' }, 'ip');
    await svc.submit({ ...sender, kind: 'view', career: 'pharmacist' }, 'ip');
    await svc.submit({ ...sender, kind: 'usage', counts: { map_island: 4, dock_results: 1 } }, 'ip');
    await svc.submit({ ...sender, kind: 'usage', counts: { map_island: 2 } }, 'ip');
    await svc.submit({ ...sender, kind: 'feedback', screen: 'results', career: null, rating: 4, liked: ['map'], confusing: ['hurdles'], text: 'call 01012345678 please' }, 'ip');

    const all = await svc.insights();
    expect(all.steps).toEqual({ 'discover_task:1': 3, 'discover_task:2': 1 });
    expect(all.views).toEqual([{ career: 'pharmacist', n: 2 }]);
    expect(all.usage).toEqual({ map_island: 6, dock_results: 1 });
    expect(all.feedback.count).toBe(1);
    expect(all.feedback.latest[0]!.text).toBe('call […] please');
    expect(all.feedback.liked).toEqual({ map: 1 });

    expect((await svc.insights('OTHER')).steps).toEqual({});
  });

  it('rejects records with extra fields or unknown actions', async () => {
    const svc = new StatsService(new MemoryStatsStore());
    await expect(svc.submit({ ...sender, kind: 'view', career: 'pharmacist', userId: 'x' }, 'ip')).rejects.toMatchObject({ code: 'invalid' });
    await expect(svc.submit({ ...sender, kind: 'usage', counts: { tracked_everything: 1 } }, 'ip')).rejects.toMatchObject({ code: 'invalid' });
  });
});
