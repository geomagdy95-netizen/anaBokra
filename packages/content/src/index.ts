import {
  STUDY_FIELDS,
  type AbilitiesInstrument,
  type CareerForMatching,
  type CareerTraits,
  type StudyField,
  type I18n,
  type LikertInstrument,
  type ValuesInstrument,
} from '@anabokra/engine';
import interestsJson from '../instruments/interests.json';
import personalityJson from '../instruments/personality.json';
import valuesJson from '../instruments/values.json';
import abilitiesJson from '../instruments/abilities.json';
import readinessJson from '../instruments/readiness.json';
import catalogJson from '../careers/catalog.json';
import careersJson from '../careers/careers.generated.json';
import studyFieldsJson from '../careers/study-fields.json';

export const instruments = {
  interests: interestsJson as LikertInstrument,
  personality: personalityJson as LikertInstrument,
  values: valuesJson as ValuesInstrument,
  abilities: abilitiesJson as AbilitiesInstrument,
  readiness: readinessJson as LikertInstrument,
};

export interface Cluster {
  id: string;
  name: I18n;
}

export interface Career extends CareerForMatching {
  name: I18n;
  proxy?: boolean;
  proxyNote?: string;
  onet: { code: string; title: string; imputedFromRelated?: string[] }[];
  hollandCode: string;
  jobZone: number | null;
  /** English seed text from O*NET, to be rewritten and localized for Egypt. */
  seed: { descriptionEn: string; tasksEn: string[] };
  traits: CareerTraits;
}

export const clusters: Cluster[] = catalogJson.clusters;
const studyFields = studyFieldsJson.fields as Record<string, string[]>;

/** Careers with their usual fields of study merged in (careers/study-fields.json). */
export const careers = (careersJson.careers as Career[]).map((c): Career => {
  const fields = (studyFields[c.id] ?? []).filter((f): f is StudyField => (STUDY_FIELDS as readonly string[]).includes(f));
  return fields.length ? { ...c, egypt: { ...c.egypt, fields } } : c;
});
export const careerSources = careersJson.sources;

export const careerById = (id: string) => careers.find((c) => c.id === id);

// ---------------------------------------------------------------------------
// Opportunities (programs, universities, providers) and industry outlook
// ---------------------------------------------------------------------------
import programsJson from '../opportunities/programs.json';
import universitiesJson from '../opportunities/universities.json';
import providersJson from '../opportunities/providers.json';
import industriesJson from '../industries/industries.json';

export type Bilingual = { en: string; ar: string };

export interface MinScore {
  year: number;
  track: string;
  scorePct: number;
  scoreRaw?: number;
  scoreMax?: number;
  system: string;
  phase?: number | null;
  kind: 'tansik-phase1-cutoff' | 'regulatory-minimum' | string;
  sourceUrl: string;
}

export interface Program {
  id: string;
  universityId: string;
  faculty: Bilingual;
  program: Bilingual | null;
  unitType: 'faculty' | 'program';
  degree: string | null;
  durationYears: number | null;
  teachingLanguage: 'en' | 'ar' | 'mixed' | null;
  acceptedTracks: string[];
  minScores: MinScore[];
  feesEgpPerYear: { value: number | null; year?: number | null; sourceUrl?: string; note?: string } | null;
  careerIds: string[];
  website: string | null;
  sourceUrl: string;
}

export interface University {
  id: string;
  name: Bilingual;
  type: string;
  governorate: string;
  city: string | null;
  website: string | null;
}

export interface Provider {
  id: string;
  name: Bilingual;
  kind: string;
  format: 'offline' | 'hybrid' | 'online' | string;
  governorates: string[];
  ageMin: number | null;
  ageMax: number | null;
  eligibility: string;
  audience: Bilingual;
  skills: string[];
  careerIds: string[];
  website: string | null;
  sourceUrl: string | null;
  verifiedAt: string | null;
  notes?: Bilingual | null;
}

export type IndustryTrend = 'growing' | 'stable' | 'transforming' | 'declining';

export interface IndustryOutlook {
  trend: IndustryTrend;
  demand5y: { low: number | null; high: number | null; unit: string; band: Bilingual };
  confidence: 'high' | 'medium' | 'low';
  rationale: Bilingual;
}

export interface Industry {
  id: string;
  name: Bilingual;
  outlook: IndustryOutlook;
  suggestedChanges: { name: Bilingual; momentum: 'rising' | 'steady' | 'fading' | string }[];
  sources: { id: string; title: string; url: string; publisher?: string; year?: number; accessed?: string }[];
}

export const programs = programsJson.programs as unknown as Program[];
export const universities = universitiesJson.universities as unknown as University[];
export const providers = providersJson.providers as unknown as Provider[];
export const industries = industriesJson.clusters as unknown as Industry[];

export const programById = (id: string) => programs.find((p) => p.id === id);
export const universityById = (id: string) => universities.find((u) => u.id === id);
export const providerById = (id: string) => providers.find((p) => p.id === id);
export const industryById = (id: string) => industries.find((i) => i.id === id);
