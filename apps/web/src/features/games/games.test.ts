import { describe, expect, it } from 'vitest';

import { memoryPath, memorySummary, nextLength } from './memory';
import { numberItem } from './numbers';
import { patienceSummary } from './patience';
import { key, lopsided, mirror, rotationItem, turn } from './rotation';
import { FEATURES, PATTERN_LEVELS, patternItem, choiceSummary, patternRun, sameFigure } from './pattern';

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
    const s = choiceSummary([
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

describe('quick numbers', () => {
  for (const level of [1, 2, 3, 4]) {
    it(`level ${level}: four different positive whole options, one right`, () => {
      for (let seed = 1; seed <= 300; seed++) {
        const item = numberItem(level, seed);
        expect(item.options).toHaveLength(4);
        expect(new Set(item.options).size).toBe(4);
        for (const o of item.options) expect(Number.isInteger(o) && o > 0).toBe(true);
        expect(item.answer).toBeGreaterThanOrEqual(0);
        expect(item.terms.at(-1)).toMatch(/\?/);
      }
    });
  }

  it('gets the arithmetic right', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const it3 = numberItem(3, seed);
      const [pct, , base] = it3.terms;
      expect(it3.options[it3.answer]).toBe((parseInt(pct!) * Number(base)) / 100);
      const it1 = numberItem(1, seed);
      const seq = it1.terms.slice(0, 4).map(Number);
      expect(it1.options[it1.answer]).toBe(seq[3]! + (seq[1]! - seq[0]!));
    }
  });
});

describe('turn the shape', () => {
  it('turning four times comes back; a lopsided shape never matches its mirror', () => {
    const l: [number, number][] = [[0, 0], [0, 1], [0, 2], [1, 2]];
    expect(key(turn(l, 4))).toBe(key(l));
    expect(lopsided(l)).toBe(true);
    expect(lopsided([[0, 0], [1, 0], [0, 1], [1, 1]])).toBe(false);
  });

  for (const level of [1, 2, 3, 4]) {
    it(`level ${level}: exactly one option is the shape turned; the rest are mirrors`, () => {
      for (let seed = 1; seed <= 150; seed++) {
        const item = rotationItem(level, seed);
        const turns = [0, 1, 2, 3].map((q) => key(turn(item.target, q)));
        const matches = item.options.filter((o) => turns.includes(key(o)));
        expect(matches).toHaveLength(1);
        expect(key(item.options[item.answer]!)).toBe(key(matches[0]!));
        expect(key(item.options[item.answer]!)).not.toBe(key(item.target));
        for (const o of item.options) if (o !== matches[0]) expect([0, 1, 2, 3].some((q) => key(turn(mirror(item.target), q)) === key(o))).toBe(true);
        expect(new Set(item.options.map(key)).size).toBe(4);
      }
    });
  }
});

describe('remember the path', () => {
  it('makes paths of the asked length with no tile twice in a row', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const p = memoryPath(7, seed);
      expect(p).toHaveLength(7);
      for (let i = 1; i < p.length; i++) expect(p[i]).not.toBe(p[i - 1]);
    }
  });

  it('grows after a success and stops after two misses at the same length', () => {
    expect(nextLength([])).toBe(3);
    expect(nextLength([{ length: 3, correct: true }])).toBe(4);
    expect(nextLength([{ length: 3, correct: true }, { length: 4, correct: false }])).toBe(4);
    expect(nextLength([{ length: 4, correct: false }, { length: 4, correct: false }])).toBeNull();
    expect(nextLength([{ length: 9, correct: true }])).toBeNull();
    expect(memorySummary([{ length: 3, correct: true }, { length: 4, correct: true }, { length: 5, correct: false }, { length: 5, correct: false }])).toEqual({ span: 4, trials: 4, correct: 2 });
  });
});
