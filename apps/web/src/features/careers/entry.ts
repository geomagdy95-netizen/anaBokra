import { programById, universityById, type Program } from '@anabokra/content';

import { latestMinScore } from './programs';
import type { AuthoredHurdle, CareerPage, EntryLevel, HurdleKind } from './types';

/** A hurdle worked out from the program data (Tansik cut-offs, fees, years), shown with message templates. */
export interface DerivedHurdle {
  kind: Extract<HurdleKind, 'grades' | 'cost' | 'time'>;
  level: 1 | 2 | 3;
  derived: true;
  values: Record<string, number>;
  source?: string;
}

export type Hurdle = (AuthoredHurdle & { derived?: false }) | DerivedHurdle;

export interface EntryView {
  level: EntryLevel;
  hurdles: Hurdle[];
}

const PUBLIC = new Set(['public', 'azhar', 'technological']);
const PAID = new Set(['private', 'national', 'international_branch']);
const LEVELS: EntryLevel[] = ['open', 'moderate', 'competitive', 'very_competitive'];

/** Grades: the spread of the latest Tansik phase-1 cut-offs of the public faculties linked to the career. */
function gradesHurdle(programs: Program[]): DerivedHurdle | null {
  const cutoffs = programs
    .filter((p) => PUBLIC.has(universityById(p.universityId)?.type ?? ''))
    .map((p) => ({ p, s: latestMinScore(p) }))
    .filter((x): x is { p: Program; s: NonNullable<ReturnType<typeof latestMinScore>> } => x.s?.kind === 'tansik-phase1-cutoff');
  if (!cutoffs.length) return null;
  const year = Math.max(...cutoffs.map((c) => c.s.year));
  const latest = cutoffs.filter((c) => c.s.year === year);
  const min = Math.min(...latest.map((c) => c.s.scorePct));
  const max = Math.max(...latest.map((c) => c.s.scorePct));
  return { kind: 'grades', level: max >= 90 ? 3 : max >= 80 ? 2 : 1, derived: true, values: { min, max, year }, source: latest[0]!.s.sourceUrl };
}

/** Cost: the yearly list price of the private, ahleya and international options linked to the career. */
function costHurdle(programs: Program[]): DerivedHurdle | null {
  const fees = programs
    .filter((p) => PAID.has(universityById(p.universityId)?.type ?? ''))
    .flatMap((p) => (p.feesEgpPerYear?.value ? [{ value: p.feesEgpPerYear.value, sourceUrl: p.feesEgpPerYear.sourceUrl }] : []));
  if (!fees.length) return null;
  const min = Math.min(...fees.map((f) => f.value));
  const max = Math.max(...fees.map((f) => f.value));
  return { kind: 'cost', level: max >= 150_000 ? 3 : max >= 60_000 ? 2 : 1, derived: true, values: { min, max }, source: fees[0]!.sourceUrl };
}

/** Overall difficulty from grades alone, when the page has no researched level. */
function levelFromGrades(g: DerivedHurdle | null): EntryLevel | null {
  if (!g) return null;
  const max = g.values.max!;
  return max >= 93 ? 'very_competitive' : max >= 85 ? 'competitive' : max >= 75 ? 'moderate' : 'open';
}

/**
 * What could stand between a student and this career: the page's researched hurdles first, then the ones
 * the program data shows (grades, cost, long study) unless a researched one already covers that kind.
 * The level is the researched one, or the harder of it and the grades. Null when nothing is known.
 */
export function entryOf(page: CareerPage | undefined): EntryView | null {
  if (!page) return null;
  const programs = (page.pathEgypt?.programIds ?? []).flatMap((id) => {
    const p = programById(id);
    return p ? [p] : [];
  });
  const authored: Hurdle[] = page.entry?.hurdles ?? [];
  const has = new Set(authored.map((h) => h.kind));
  const grades = gradesHurdle(programs);
  const derived: DerivedHurdle[] = [];
  if (grades && !has.has('grades')) derived.push(grades);
  const cost = costHurdle(programs);
  if (cost && !has.has('cost')) derived.push(cost);
  const years = page.pathEgypt?.studyYears;
  if (years && years >= 6 && !has.has('time')) derived.push({ kind: 'time', level: 2, derived: true, values: { years } });

  const fromGrades = levelFromGrades(grades);
  const authoredLevel = page.entry?.level ?? null;
  const level = [authoredLevel, fromGrades].filter((x): x is EntryLevel => Boolean(x)).sort((a, b) => LEVELS.indexOf(b) - LEVELS.indexOf(a))[0];
  const hurdles = [...authored, ...derived].sort((a, b) => b.level - a.level);
  if (!level && !hurdles.length) return null;
  return { level: level ?? (hurdles.some((h) => h.level === 3) ? 'competitive' : 'moderate'), hurdles };
}
