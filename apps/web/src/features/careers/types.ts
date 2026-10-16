import type { Bilingual } from '@anabokra/content';

export type Locale = 'ar' | 'en';
export type Track = 'science' | 'math' | 'literary';
export const TRACKS: Track[] = ['science', 'math', 'literary'];

export interface SalaryBand {
  min: number;
  max: number;
}

export interface SalaryData {
  junior: SalaryBand | null;
  mid: SalaryBand | null;
  senior: SalaryBand | null;
  year: number;
  sourceUrl: string;
  note?: Bilingual;
}

export interface SourceRef {
  title: string;
  url: string;
  accessed?: string;
}

/**
 * A career page as stored in packages/content/careers/pages. `depth: "full"` pages carry every section;
 * `depth: "lite"` pages carry only some, so everything beyond the always-present core is optional and
 * the UI renders only what exists.
 */
export interface CareerPage {
  id: string;
  version?: string;
  status?: string;
  lastReviewedAt?: string;
  depth: 'full' | 'lite';
  industryId?: string;
  snapshot?: { hook?: Bilingual; summary?: Bilingual; dayInLife?: Bilingual };
  whatYouDo?: { tasks?: Bilingual[]; environments?: Bilingual[]; tools?: Bilingual[] };
  pathEgypt?: {
    thanaweyaTracks?: Track[];
    otherCurricula?: Bilingual;
    faculties?: Bilingual[];
    programIds?: string[];
    tansikNote?: Bilingual;
    studyYears?: number | null;
    alternativeRoutes?: Bilingual[];
    licensing?: Bilingual | null;
  };
  skills?: {
    hard?: Bilingual[];
    soft?: Bilingual[];
    languages?: Bilingual[];
    certifications?: Bilingual[];
    starterResources?: { title: string; url: string; free?: boolean }[];
  };
  marketEgypt?: {
    salaryMonthlyEgp?: SalaryData | null;
    salaryNote?: Bilingual;
    demand?: 'high' | 'medium' | 'low';
    employers?: Bilingual[];
    freelanceRemote?: Bilingual;
    regions?: Bilingual[];
    providerIds?: string[];
  };
  global?: Bilingual;
  reality?: {
    pros?: Bilingual[];
    challenges?: Bilingual[];
    myths?: { myth: Bilingual; fact: Bilingual }[];
    workLifeBalance?: Bilingual;
  };
  progression?: { ladder?: Bilingual[]; relatedCareerIds?: string[]; pivots?: Bilingual[] };
  /** Researched hurdles on the way in (grades, exams, interviews, checks, cost...); see entry.ts. */
  entry?: { level: EntryLevel; hurdles: AuthoredHurdle[] };
  sources?: SourceRef[];
}

export type EntryLevel = 'open' | 'moderate' | 'competitive' | 'very_competitive';
export type HurdleKind = 'grades' | 'exam' | 'interview' | 'vetting' | 'age' | 'physical' | 'license' | 'membership' | 'cost' | 'time' | 'experience' | 'gender' | 'location';

/** One hurdle as written in a career page, with a tip on how people get past it and its source. */
export interface AuthoredHurdle {
  kind: HurdleKind;
  /** 1 manageable, 2 hard, 3 very hard. */
  level: 1 | 2 | 3;
  text: Bilingual;
  tip?: Bilingual;
  source: string;
}

/** Per-user match data for one career, computed on the server from the latest stored result. */
export interface PersonalFit {
  fit: number;
  reasons: unknown[];
  watchOuts: unknown[];
  flags: string[];
}

export interface PersonalData {
  signedIn: boolean;
  /** Fit per career id; empty when the user has no result yet. */
  fits: Record<string, PersonalFit>;
  hasResult: boolean;
  favorites: string[];
  /** Favorites are unavailable (guardian consent missing, or storage error). */
  favoritesLocked: 'consent_required' | 'unavailable' | null;
}

export const EMPTY_PERSONAL: PersonalData = {
  signedIn: false,
  fits: {},
  hasResult: false,
  favorites: [],
  favoritesLocked: null,
};

export const MAX_COMPARE = 3;
export const MIN_COMPARE = 2;
