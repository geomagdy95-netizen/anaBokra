import { careers, paths } from '@anabokra/content';
import { describe, expect, it } from 'vitest';

import { MemoryKv } from '@/lib/local/kv';
import { careerPageIds, getCareerPage } from '@/server/content/career-pages';

import {
  CAREER_CAP,
  CareerCapError,
  careerIslets,
  careerState,
  careerUnlocked,
  questBeatIds,
  questDone,
  questPlan,
  saveQuestAnswer,
  saveQuestResult,
  scoreQuest,
  setCareerSelected,
} from './career-quest';
import { readJourney, saveVerifyResult, scoreVerify } from './verify';

const page = (id: string) => getCareerPage(id)!;

/** Answers every beat: reactions `react`, every task tapped when `tasks`, first option elsewhere. */
function answerAll(id: string, react: number, tasks: boolean) {
  const a: Record<string, number> = {};
  for (const b of questPlan(page(id))) for (const k of questBeatIds(b)) a[k] = b.kind === 'tasks' ? (tasks ? 1 : 0) : b.kind === 'salary' || b.kind === 'myth' ? 0 : react;
  return a;
}

describe('career quest', () => {
  it('builds a short quest for every career from its page', () => {
    expect(careerPageIds().sort()).toEqual(careers.map((c) => c.id).sort());
    for (const id of careerPageIds()) {
      const beats = questPlan(page(id));
      expect(beats.length).toBeGreaterThanOrEqual(5);
      expect(beats.length).toBeLessThanOrEqual(7);
      expect(beats[0]!.kind).toBe('day');
      const salary = beats.find((b) => b.kind === 'salary');
      if (salary?.kind === 'salary') {
        // The real range is one of four, and the ranges don't overlap.
        expect(salary.options).toHaveLength(4);
        for (let i = 1; i < 4; i++) expect(salary.options[i]!.min).toBeGreaterThan(salary.options[i - 1]!.max);
        for (const o of salary.options) expect(o.max).toBeGreaterThan(o.min);
        expect(salary.options[0]!.min).toBeGreaterThan(0);
      }
    }
  });

  it('scores enjoyment and realities, never the salary guess or the myth', () => {
    const keen = scoreQuest(page('pharmacist'), answerAll('pharmacist', 3, true), { profileFit: 70 });
    expect(keen.components).toEqual({ profile: 0.7, activities: 1, realities: 1 });
    expect(keen.band).toBe('fitsWell');
    const cool = scoreQuest(page('pharmacist'), answerAll('pharmacist', 1, false), { profileFit: 70 });
    expect(cool.band).toBe('rethink');
    expect(cool.hardFor).toEqual([0, 1]);
    // Getting the pay or the myth "wrong" changes nothing.
    const wrong = { ...answerAll('pharmacist', 3, true), salary: 3, myth: 1 };
    expect(scoreQuest(page('pharmacist'), wrong, { profileFit: 70 }).fit).toBe(keen.fit);
    expect(questDone(page('pharmacist'), keen.likedTasks.length ? answerAll('pharmacist', 2, true) : {})).toBe(true);
  });
});

describe('career islands', () => {
  async function checkedHealth() {
    const kv = new MemoryKv();
    const health = paths.health!;
    const result = scoreVerify(health, {}, { groupFit: 60, careerFits: { pharmacist: 80, nurse: 70, physician: 75, dentist: 50 } });
    await saveVerifyResult(kv, 'p1', result);
    return kv;
  }

  it('open once the group is checked, three islets first, then the ones the user started', async () => {
    const kv = new MemoryKv();
    expect(careerUnlocked(await readJourney(kv, 'p1'), 'pharmacist')).toBe(false);
    const checked = await checkedHealth();
    const doc = await readJourney(checked, 'p1');
    expect(careerUnlocked(doc, 'pharmacist')).toBe(true);
    expect(careerUnlocked(doc, 'accountant')).toBe(false);
    expect(careerIslets(doc, 'health')).toEqual(['pharmacist', 'physician', 'nurse']);
    await saveQuestAnswer(checked, 'p1', 'dentist', 'day', 3);
    const after = await readJourney(checked, 'p1');
    expect(careerState(after, 'dentist')).toBe('building');
    expect(careerIslets(after, 'health')).toEqual(['pharmacist', 'physician', 'nurse', 'dentist']);
  });

  it('selects at most two reached careers, enforced in the progress logic', async () => {
    const kv = await checkedHealth();
    await expect(setCareerSelected(kv, 'p1', 'nurse', true)).rejects.toThrow('career_not_reached');
    for (const id of ['nurse', 'pharmacist', 'dentist']) await saveQuestResult(kv, 'p1', scoreQuest(page(id), answerAll(id, 2, true), { profileFit: 60 }));
    await setCareerSelected(kv, 'p1', 'nurse', true);
    expect(await setCareerSelected(kv, 'p1', 'pharmacist', true)).toEqual(['nurse', 'pharmacist']);
    expect(CAREER_CAP).toBe(2);
    await expect(setCareerSelected(kv, 'p1', 'dentist', true)).rejects.toBeInstanceOf(CareerCapError);
    expect(await setCareerSelected(kv, 'p1', 'nurse', false)).toEqual(['pharmacist']);
    expect(await setCareerSelected(kv, 'p1', 'dentist', true)).toEqual(['pharmacist', 'dentist']);
    expect(careerState(await readJourney(kv, 'p1'), 'dentist')).toBe('selected');
  });
});
