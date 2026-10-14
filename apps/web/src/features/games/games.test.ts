import { describe, expect, it } from 'vitest';

import { patienceSummary } from './patience';
import { FEATURES, PATTERN_LEVELS, patternItem, patternRun, patternSummary, sameFigure } from './pattern';

describe('pattern logic items', () => {
  it('is the same for the same seed', () => {
    expect(patternItem(3, 42)).toEqual(patternItem(3, 42));
  });

  for (const level of [1, 2, 3, 4]) {
    it(`level ${level}: one right answer, three distinct wrong ones each one feature off`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const item = patternItem(level, seed);
        expect(item.cells).toHaveLength(9);
        expect(item.options).toHaveLength(4);
        const answer = item.options[item.answer]!;
        expect(sameFigure(answer, item.cells[8]!)).toBe(true);
        const wrong = item.options.filter((_, i) => i !== item.answer);
        for (const w of wrong) expect(FEATURES.filter((f) => w[f] !== answer[f])).toHaveLength(1);
        for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(sameFigure(item.options[i]!, item.options[j]!)).toBe(false);
        expect(Object.keys(item.rules)).toHaveLength({ 1: 1, 2: 2, 3: 2, 4: 3 }[level]!);
      }
    });
  }

  it('follows its rules: every ruled feature shows all three values in each row or column', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const item = patternItem(4, seed);
      for (const [f, rule] of Object.entries(item.rules) as [keyof (typeof item.cells)[number], string][]) {
        for (let k = 0; k < 3; k++) {
          const line = rule === 'row' ? [0, 1, 2].map((c) => item.cells[c * 3 + k]![f]) : [0, 1, 2].map((c) => item.cells[k * 3 + c]![f]);
          expect(new Set(line).size).toBe(3);
        }
      }
    }
  });

  it('runs a practice item and eight from easy to hard', () => {
    const run = patternRun(7);
    expect(run.practice.level).toBe(1);
    expect(run.items.map((i) => i.level)).toEqual([...PATTERN_LEVELS]);
  });

  it('summarises right answers, the hardest level solved and times', () => {
    const s = patternSummary([
      { level: 1, correct: true, ms: 4000 },
      { level: 2, correct: true, ms: 6000 },
      { level: 3, correct: false, ms: 9000 },
      { level: 4, correct: true, ms: 12000 },
    ]);
    expect(s).toMatchObject({ correct: 3, total: 4, hardestSolved: 4, medianMs: 9000, totalMs: 31000, byLevel: { 1: 1, 2: 1, 3: 0, 4: 1 } });
  });
});

describe('patience game', () => {
  it('counts waits, early stops and how far waits got', () => {
    const s = patienceSummary([
      { delay: 4, choice: 'waited', waited: 4, decideMs: 800 },
      { delay: 8, choice: 'now', waited: 0, decideMs: 500 },
      { delay: 12, choice: 'stopped', waited: 6, decideMs: 900 },
    ]);
    expect(s).toMatchObject({ rounds: 3, choseToWait: 2, waitedToTheEnd: 1, stoppedEarly: 1, longestWaited: 4, fish: 5, secondsWaited: 10 });
    expect(s.meanShareWaited).toBeCloseTo(0.75);
  });
});
