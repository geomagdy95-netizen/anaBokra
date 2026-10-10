import { programs, providers, universities, universityById, type Program, type Provider, type University } from '@anabokra/content';

import { governorateId } from './governorates';
import { latestCutoffs, latestRegulatoryMinimum, type Cutoff } from './feasibility';

export type Locale = 'ar' | 'en';
export type Bi = { ar: string; en: string };

export const UNIVERSITY_TYPES = ['public', 'private', 'national', 'technological', 'international_branch', 'azhar'] as const;
export const TEACHING_LANGUAGES = ['ar', 'en', 'mixed'] as const;
export const TRACK_IDS = ['science', 'math', 'literary'] as const;

/** Compact row sent to the client; one per program. */
export interface ProgramRow {
  id: string;
  universityId: string;
  universityName: Bi;
  universityType: string;
  governorate: string | null;
  name: Bi;
  degree: string | null;
  language: string | null;
  tracks: string[];
  years: number | null;
  fee: { value: number; year: number | null } | null;
  /** Latest tansik cutoff per track. */
  cutoffs: Cutoff[];
  careerIds: string[];
  /** Regulatory minimum, shown only with its own label. */
  minimum: { year: number; pct: number } | null;
}

export interface UniversityRow {
  id: string;
  name: Bi;
  type: string;
  governorate: string | null;
  city: string | null;
  programCount: number;
}

export interface ProviderRow {
  id: string;
  name: Bi;
  kind: string;
  format: string;
  governorates: string[];
  audience: Bi;
}

export const programName = (p: Program): Bi => ({
  ar: p.program ? `${p.faculty.ar} - ${p.program.ar}` : p.faculty.ar,
  en: p.program ? `${p.faculty.en} - ${p.program.en}` : p.faculty.en,
});

export function toProgramRow(p: Program, uni: University | undefined = universityById(p.universityId)): ProgramRow {
  const fee = p.feesEgpPerYear?.value != null ? { value: p.feesEgpPerYear.value, year: p.feesEgpPerYear.year ?? null } : null;
  const min = latestRegulatoryMinimum(p.minScores);
  return {
    id: p.id,
    universityId: p.universityId,
    universityName: uni?.name ?? { ar: p.universityId, en: p.universityId },
    universityType: uni?.type ?? 'other',
    governorate: governorateId(uni?.governorate),
    name: programName(p),
    degree: p.degree,
    language: p.teachingLanguage,
    tracks: p.acceptedTracks,
    years: p.durationYears,
    fee,
    careerIds: p.careerIds,
    cutoffs: latestCutoffs(p.minScores),
    minimum: min ? { year: min.year, pct: min.pct } : null,
  };
}

export const getProgramRows = (): ProgramRow[] => programs.map((p) => toProgramRow(p));

export function getUniversityRows(): UniversityRow[] {
  const count = new Map<string, number>();
  for (const p of programs) count.set(p.universityId, (count.get(p.universityId) ?? 0) + 1);
  return universities.map((u) => ({
    id: u.id,
    name: u.name,
    type: u.type,
    governorate: governorateId(u.governorate),
    city: u.city,
    programCount: count.get(u.id) ?? 0,
  }));
}

export const getProviderRows = (): ProviderRow[] =>
  providers.map((p: Provider) => ({ id: p.id, name: p.name, kind: p.kind, format: p.format, governorates: p.governorates, audience: p.audience }));

export interface ExploreCatalog {
  programs: ProgramRow[];
  universities: UniversityRow[];
  providers: ProviderRow[];
}

export const getExploreCatalog = (): ExploreCatalog => ({ programs: getProgramRows(), universities: getUniversityRows(), providers: getProviderRows() });

/** Counts of universities per governorate id, for the map and the grouped list. */
export function universitiesByGovernorate(rows: UniversityRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) if (r.governorate) out[r.governorate] = (out[r.governorate] ?? 0) + 1;
  return out;
}
