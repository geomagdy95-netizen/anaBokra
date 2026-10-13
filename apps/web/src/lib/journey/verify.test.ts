import { enjoyId, paths } from '@anabokra/content';
import { describe, expect, it } from 'vitest';

import { MemoryKv } from '@/lib/local/kv';

import { bandFor, pathAnswerAllowed, readJourney, saveRating, saveVerifyAnswer, saveVerifyResult, scoreVerify, setInList, taskDone, taskItemIds } from './verify';

const health = paths.health!;
const [day, real, tryIt] = health.tasks;

function answersAll(story: number, pathSide: boolean, enjoy: number, scenarioBest: boolean) {
  const a: Record<string, number> = {};
  if (day?.kind === 'story') for (const i of day.items) a[i.id] = story;
  if (real?.kind === 'thisOrThat') for (const i of real.items) a[i.id] = pathSide === (i.path === 'a') ? 0 : 1;
  if (tryIt?.kind === 'tryIt')
    for (const i of tryIt.items) {
      a[i.id] = i.type === 'scenario' ? (scenarioBest ? i.options.findIndex((o) => o.fit === 1) : i.options.findIndex((o) => o.fit === 0)) : 0;
      a[enjoyId(i.id)] = enjoy;
    }
  return a;
}

const fits = { physician: 80, nurse: 70, pharmacist: 75, dentist: 60, physical_therapist: 65, clinical_nutritionist: 55, medical_lab_scientist: 50, radiology_technologist: 50, veterinarian: 40, clinical_psychologist: 45 };

describe('Verify scoring', () => {
  it('fits well when the profile fits and the user enjoys the path and accepts its realities', () => {
    const r = scoreVerify(health, answersAll(3, true, 3, true), { groupFit: 75, careerFits: fits });
    expect(r.band).toBe('fitsWell');
    expect(r.components).toEqual({ profile: 0.75, activities: 1, realities: 1 });
    expect(r.enjoyed).toHaveLength(3);
    expect(r.turnedDown).toEqual([]);
    expect(r.careers).toHaveLength(10);
  });

  it('is worth rethinking when nothing appeals, even with a decent profile fit', () => {
    const r = scoreVerify(health, answersAll(1, false, 1, false), { groupFit: 70, careerFits: fits });
    expect(r.band).toBe('rethink');
    expect(r.turnedDown).toHaveLength(6);
  });

  it('flags careers whose specific realities were turned down, and moves them down', () => {
    const a = answersAll(3, true, 3, true);
    a['health_real_2'] = 1; // regular daytime hours instead of night shifts (doctors, nurses)
    const r = scoreVerify(health, a, { groupFit: 75, careerFits: fits });
    expect(r.careers.find((c) => c.careerId === 'nurse')!.cautions).toEqual(['health_real_2']);
    expect(r.careers.find((c) => c.careerId === 'pharmacist')!.cautions).toEqual([]);
    const pharm = r.careers.findIndex((c) => c.careerId === 'pharmacist');
    const phys = r.careers.findIndex((c) => c.careerId === 'physician');
    expect(pharm).toBeLessThan(phys);
  });

  it('uses the draft band cut-offs', () => {
    expect([bandFor(0.7), bandFor(0.5), bandFor(0.3)]).toEqual(['fitsWell', 'fitsPartly', 'rethink']);
  });

  it('knows when a task is done (try-it items need the enjoy answer too)', () => {
    const a = answersAll(2, true, 2, true);
    for (const t of health.tasks) expect(taskDone(t, a)).toBe(true);
    delete a[enjoyId('health_try_1')];
    expect(taskDone(tryIt!, a)).toBe(false);
    expect(taskItemIds(tryIt!)).toContain('health_try_1_enjoy');
  });
});

describe('Verify storage', () => {
  it('keeps answers and the result per path', async () => {
    const kv = new MemoryKv();
    await saveVerifyAnswer(kv, 'p1', 'health', 'health_day_1', 3);
    await saveVerifyAnswer(kv, 'p1', 'health', 'health_day_2', 1);
    const r = scoreVerify(health, { health_day_1: 3, health_day_2: 1 }, { groupFit: 60, careerFits: fits });
    await saveVerifyResult(kv, 'p1', r);
    const doc = await readJourney(kv, 'p1');
    expect(doc.paths.health!.answers).toEqual({ health_day_1: 3, health_day_2: 1 });
    expect(doc.paths.health!.result!.pathId).toBe('health');
    expect((await readJourney(kv, 'other')).paths).toEqual({});
  });
});

describe('added and saved paths', () => {
  it('adds once, removes, and keeps the lists apart', async () => {
    const kv = new MemoryKv();
    expect(await setInList(kv, 'p1', 'added', 'law', true)).toEqual(['law']);
    expect(await setInList(kv, 'p1', 'added', 'law', true)).toEqual(['law']);
    expect(await setInList(kv, 'p1', 'saved', 'tech', true)).toEqual(['tech']);
    await saveVerifyAnswer(kv, 'p1', 'health', 'health_day_1', 3);
    expect(await setInList(kv, 'p1', 'added', 'law', false)).toEqual([]);
    const doc = await readJourney(kv, 'p1');
    expect(doc).toMatchObject({ added: [], saved: ['tech'], paths: { health: { answers: { health_day_1: 3 } } } });
  });
});

describe('results rating', () => {
  it('keeps one rating from 1 to 5 in the journey record', async () => {
    const kv = new MemoryKv();
    await saveRating(kv, 'p1', 4, new Date('2026-11-20T10:00:00Z'));
    expect((await readJourney(kv, 'p1')).rating).toEqual({ value: 4, at: '2026-11-20T10:00:00.000Z' });
    await expect(saveRating(kv, 'p1', 6)).rejects.toThrow();
    await expect(saveRating(kv, 'p1', 0)).rejects.toThrow();
  });
});

describe('allowed path answers', () => {
  it('follows each item type', () => {
    const tech = paths.tech!;
    const story = tech.tasks.find((t) => t.kind === 'story')!.items[0]!;
    const choice = tech.tasks.find((t) => t.kind === 'thisOrThat')!.items[0]!;
    const tryItem = tech.tasks.find((t) => t.kind === 'tryIt')!.items[0] as { id: string; options: unknown[] };
    expect([1, 2, 3].every((v) => pathAnswerAllowed(tech, story.id, v))).toBe(true);
    expect(pathAnswerAllowed(tech, story.id, 0)).toBe(false);
    expect(pathAnswerAllowed(tech, choice.id, 1)).toBe(true);
    expect(pathAnswerAllowed(tech, choice.id, 2)).toBe(false);
    expect(pathAnswerAllowed(tech, tryItem.id, tryItem.options.length - 1)).toBe(true);
    expect(pathAnswerAllowed(tech, tryItem.id, tryItem.options.length)).toBe(false);
    expect(pathAnswerAllowed(tech, enjoyId(tryItem.id), 3)).toBe(true);
    expect(pathAnswerAllowed(tech, enjoyId(tryItem.id), 4)).toBe(false);
    expect(pathAnswerAllowed(tech, 'nope', 1)).toBe(false);
    expect(pathAnswerAllowed(tech, story.id, 1.5)).toBe(false);
  });
});
