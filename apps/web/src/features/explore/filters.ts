import { matchesQuery } from '@/features/careers/search';

import type { ProgramRow, ProviderRow, UniversityRow } from './catalog';
import { placeId } from './governorates';
import { assessFeasibility, type Feasibility, type FeasibilityUser } from './feasibility';

export type FeasibilityFilter = 'any' | 'likely' | 'reach' | 'unlikely';

export interface ProgramFilters {
  q: string;
  type: string;
  governorate: string;
  track: string;
  language: string;
  /** Fee range in EGP/year. Setting either bound keeps only programs that HAVE a fee. */
  feeMin: number | null;
  feeMax: number | null;
  feasibility: FeasibilityFilter;
}

export const EMPTY_PROGRAM_FILTERS: ProgramFilters = { q: '', type: '', governorate: '', track: '', language: '', feeMin: null, feeMax: null, feasibility: 'any' };

export interface ProgramHit {
  row: ProgramRow;
  feasibility: Feasibility;
}

export function filterPrograms(rows: ProgramRow[], f: ProgramFilters, user: FeasibilityUser): ProgramHit[] {
  const hits: ProgramHit[] = [];
  for (const row of rows) {
    if (f.type && row.universityType !== f.type) continue;
    if (f.governorate && row.governorate !== f.governorate) continue;
    if (f.track && !row.tracks.includes(f.track)) continue;
    if (f.language && row.language !== f.language) continue;
    if (f.feeMin != null || f.feeMax != null) {
      if (!row.fee) continue;
      if (f.feeMin != null && row.fee.value < f.feeMin) continue;
      if (f.feeMax != null && row.fee.value > f.feeMax) continue;
    }
    if (f.q && !matchesQuery(f.q, row.name.ar, row.name.en, row.universityName.ar, row.universityName.en, row.degree ?? '')) continue;
    const feasibility = assessFeasibility(row.cutoffs, row.tracks, user);
    if (f.feasibility !== 'any' && feasibility.status !== f.feasibility) continue;
    hits.push({ row, feasibility });
  }
  return hits;
}

export function filterUniversities(rows: UniversityRow[], f: Pick<ProgramFilters, 'q' | 'type' | 'governorate'>): UniversityRow[] {
  return rows.filter((r) => (!f.type || r.type === f.type) && (!f.governorate || r.governorate === f.governorate) && (!f.q || matchesQuery(f.q, r.name.ar, r.name.en, r.city ?? '')));
}

/** Providers that serve a governorate also include "nationwide" and "online" ones. */
export function filterProviders(rows: ProviderRow[], f: Pick<ProgramFilters, 'q' | 'governorate'>): ProviderRow[] {
  return rows.filter((r) => {
    if (f.governorate) {
      const ok = r.governorates.some((g) => ['nationwide', 'online', f.governorate].includes(placeId(g)));
      if (!ok) return false;
    }
    return !f.q || matchesQuery(f.q, r.name.ar, r.name.en, r.audience.ar, r.audience.en);
  });
}

export const MAX_COMPARE_PROGRAMS = 3;
export const MIN_COMPARE_PROGRAMS = 2;

/** Toggle a program in the compare tray. Adding beyond the limit is refused (`full`), never silently dropped. */
export function toggleCompare(ids: string[], id: string): { ids: string[]; full: boolean } {
  if (ids.includes(id)) return { ids: ids.filter((x) => x !== id), full: false };
  if (ids.length >= MAX_COMPARE_PROGRAMS) return { ids, full: true };
  return { ids: [...ids, id], full: false };
}

/** Parse `?ids=a,b,c`: dedupe, drop blanks, cap at the limit. */
export function parseCompareIds(raw: string | undefined | null): string[] {
  const out: string[] = [];
  for (const part of (raw ?? '').split(',')) {
    const id = part.trim();
    if (id && !out.includes(id)) out.push(id);
  }
  return out.slice(0, MAX_COMPARE_PROGRAMS);
}
