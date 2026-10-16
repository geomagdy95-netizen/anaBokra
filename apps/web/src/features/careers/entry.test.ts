import { describe, expect, it } from 'vitest';

import { getCareerPage } from '@/server/content/career-pages';

import { entryOf } from './entry';
import type { CareerPage } from './types';

describe('entryOf', () => {
  it('puts researched hurdles first, hardest first, and keeps the researched level', () => {
    const e = entryOf(getCareerPage('judge_prosecutor'))!;
    expect(e.level).toBe('very_competitive');
    expect(e.hurdles[0]!.level).toBe(3);
    expect(e.hurdles.map((h) => h.kind)).toEqual(expect.arrayContaining(['interview', 'vetting', 'grades', 'age', 'gender']));
    // The researched grades hurdle replaces the one from Tansik data.
    expect(e.hurdles.filter((h) => h.kind === 'grades')).toHaveLength(1);
    expect(e.hurdles.find((h) => h.kind === 'grades')!.derived).toBeFalsy();
  });

  it('works out grades, cost and long study from the program data when nothing is researched', () => {
    const page = { ...getCareerPage('physician')!, entry: undefined } as CareerPage;
    const e = entryOf(page)!;
    const grades = e.hurdles.find((h) => h.kind === 'grades')!;
    expect(grades.derived).toBe(true);
    expect(grades.level).toBe(3);
    expect(grades.derived && grades.values.min).toBeGreaterThan(90);
    expect(e.hurdles.some((h) => h.kind === 'cost')).toBe(true);
    expect(e.hurdles.some((h) => h.kind === 'time')).toBe(true);
    expect(e.level).toBe('very_competitive');
  });

  it('returns null when nothing is known', () => {
    expect(entryOf(undefined)).toBeNull();
    expect(entryOf({ id: 'x', depth: 'lite' })).toBeNull();
  });
});
