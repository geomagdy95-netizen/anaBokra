import { salarySpan } from '@/features/careers/catalog';
import { entryOf } from '@/features/careers/entry';
import type { EntryLevel } from '@/features/careers/types';

import { careerPageIds, getCareerPage } from './career-pages';

/** The few facts a match card shows for a career (small enough to send for all careers at once). */
export interface CareerFacts {
  pay: { min: number; max: number } | null;
  years: number | null;
  entry: { level: EntryLevel; hurdles: number } | null;
}

let cache: Record<string, CareerFacts> | null = null;

/** Facts for every career with a page, worked out once per server process. */
export function careerFacts(): Record<string, CareerFacts> {
  if (cache) return cache;
  cache = Object.fromEntries(
    careerPageIds().map((id) => {
      const page = getCareerPage(id);
      const entry = entryOf(page);
      return [id, { pay: salarySpan(page), years: page?.pathEgypt?.studyYears ?? null, entry: entry ? { level: entry.level, hurdles: entry.hurdles.length } : null }];
    }),
  );
  return cache;
}
