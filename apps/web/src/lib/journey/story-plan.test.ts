import { careers, enjoyId, paths } from '@anabokra/content';
import { describe, expect, it } from 'vitest';

import { beatIds, STORY_SIZE, storyDone, storyPlan } from './story-plan';
import { scoreVerify } from './verify';

describe('the path story', () => {
  it('asks a short mix for every path, opening with a moment, with no kind twice in a row more than needed', () => {
    for (const path of Object.values(paths)) {
      const beats = storyPlan(path);
      const count = (k: string) => beats.filter((b) => b.kind === k).length;
      expect(count('moment')).toBe(STORY_SIZE.moment);
      expect(count('choice')).toBe(STORY_SIZE.choice);
      expect(count('try')).toBe(STORY_SIZE.try);
      expect(beats[0]!.kind).toBe('moment');
      for (let i = 2; i < beats.length; i++) expect(beats[i]!.kind === beats[i - 1]!.kind && beats[i]!.kind === beats[i - 2]!.kind).toBe(false);
      expect(beats.some((b) => b.kind === 'try' && b.item.type === 'puzzle')).toBe(true);
      const ids = beats.flatMap(beatIds);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('picks the moments that touch the most careers', () => {
    const health = paths.health!;
    const moments = storyPlan(health).filter((b) => b.kind === 'moment');
    const touched = new Set(moments.flatMap((b) => b.item.careers ?? []));
    // 14 careers (the 4 added in October have no day moment yet), 5 moments: 8 is the most any 5 can touch.
    expect(careers.filter((c) => c.cluster === 'health').length).toBe(14);
    expect(touched.size).toBe(8);
  });

  it('is done once its beats are answered, and scores from them alone', () => {
    const health = paths.health!;
    const answers: Record<string, number> = {};
    for (const b of storyPlan(health)) {
      if (b.kind === 'moment') answers[b.item.id] = 3;
      if (b.kind === 'choice') answers[b.item.id] = b.item.path === 'a' ? 0 : 1;
      if (b.kind === 'try') {
        answers[b.item.id] = 0;
        answers[enjoyId(b.item.id)] = 3;
      }
    }
    expect(storyDone(health, answers)).toBe(true);
    const r = scoreVerify(health, answers, { groupFit: 70, careerFits: {} });
    expect(r.components.realities).toBe(1);
    expect(r.enjoyed).toHaveLength(3);
    const missing = { ...answers };
    delete missing[enjoyId(storyPlan(health).find((b) => b.kind === 'try')!.item.id)];
    expect(storyDone(health, missing)).toBe(false);
  });
});
