import { careerById, clusters } from '@anabokra/content';
import { ABILITY_DOMAINS, BIG_FIVE, RIASEC, WORK_VALUES, type AbilityDomain, type BigFive, type Riasec, type WorkValue } from '@anabokra/engine';
import type { CareerExplanation } from '@anabokra/ai';

import { bandOf, type Band } from './bands';

type Locale = 'ar' | 'en';

export interface TypeView {
  id: Riasec;
  band: Band;
}
export interface TraitView {
  trait: BigFive;
  band: Band;
}
export interface AbilityView {
  domain: AbilityDomain;
  band: Band;
  /** True when the level comes only from the student's own rating. */
  selfReported: boolean;
}
export interface MatchView {
  careerId: string;
  name: string;
  cluster: string;
  fit: number;
  rank: number;
  text: string;
  reasons: string[];
  watchOuts: string[];
  flags: string[];
  surprising: boolean;
}

export interface ProfileView {
  hollandCode: string;
  types: TypeView[]; // the three code letters, in code order
  interests: Partial<Record<Riasec, Band>>;
  bigFive: TraitView[];
  values: { value: WorkValue; band: Band }[]; // top 3
  abilities: AbilityView[];
}

export interface ResultView extends ProfileView {
  resultId: string;
  sessionId: string;
  summary: string;
  top: MatchView[];
  more: MatchView[];
  surprising: MatchView[];
}

export interface RawResult {
  id: string;
  sessionId: string;
  scores: Record<string, unknown>;
  matches: unknown[];
}

interface StoredLike {
  careerId: string;
  cluster: string;
  fit: number;
  rank?: number;
  kind?: 'top' | 'surprising';
  surprising?: boolean;
}

const rec = (v: unknown): Record<string, number> => (v && typeof v === 'object' ? (v as Record<string, number>) : {});
const isRiasec = (c: string): c is Riasec => (RIASEC as readonly string[]).includes(c);

/** Everything about the person (no explanations), tolerant of partial results. */
export function buildProfileView(scores: Record<string, unknown>): ProfileView {
  const interests = rec(scores.interests);
  const personality = rec(scores.personality);
  const values = rec(scores.values);
  const abilities = rec(scores.abilities);
  const derived = (scores.derived ?? {}) as { hollandCode?: string; valuesRanking?: string[]; abilityBasis?: Record<string, string> };

  const sortedTypes = [...RIASEC].filter((r) => r in interests).sort((a, b) => interests[b]! - interests[a]!);
  const code = (derived.hollandCode ?? sortedTypes.slice(0, 3).join('')).toUpperCase();
  const letters = code.split('').filter(isRiasec).slice(0, 3);

  const ranking = (derived.valuesRanking ?? []).filter((v): v is WorkValue => (WORK_VALUES as readonly string[]).includes(v));
  const byScore = [...WORK_VALUES].filter((v) => v in values).sort((a, b) => values[b]! - values[a]!);
  const topValues = (ranking.length ? ranking : byScore).slice(0, 3);

  return {
    hollandCode: letters.join(''),
    types: letters.map((id) => ({ id, band: bandOf(interests[id] ?? 0) })),
    interests: Object.fromEntries(RIASEC.filter((r) => r in interests).map((r) => [r, bandOf(interests[r]!)])),
    bigFive: BIG_FIVE.filter((t) => t in personality).map((trait) => ({ trait, band: bandOf(personality[trait]!) })),
    values: topValues.map((value) => ({ value, band: bandOf(values[value] ?? 0.5) })),
    abilities: ABILITY_DOMAINS.filter((d) => d in abilities).map((domain) => ({
      domain,
      band: bandOf(abilities[domain]!),
      selfReported: derived.abilityBasis?.[domain] === 'self',
    })),
  };
}

export const storedMatches = (raw: unknown[]): StoredLike[] => (raw as StoredLike[]).filter((m) => m && typeof m.careerId === 'string');

/** Splits stored matches into the top 5, the next ranks and the surprising ones. */
export function splitMatches(raw: unknown[]) {
  const all = storedMatches(raw);
  const ranked = all.filter((m) => m.kind !== 'surprising').sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  return {
    top: ranked.slice(0, 5),
    more: ranked.slice(5, 20),
    surprising: all.filter((m) => m.surprising === true).slice(0, 3),
  };
}

export function toMatchView(m: StoredLike, lang: Locale, ex?: CareerExplanation): MatchView {
  const career = careerById(m.careerId);
  const cluster = clusters.find((c) => c.id === m.cluster);
  return {
    careerId: m.careerId,
    name: career?.name[lang] ?? m.careerId,
    cluster: cluster?.name[lang] ?? m.cluster,
    fit: Math.round(m.fit),
    rank: m.rank ?? 0,
    text: ex?.text ?? '',
    reasons: ex?.reasons ?? [],
    watchOuts: ex?.watchOuts ?? [],
    flags: ex?.flags ?? [],
    surprising: m.surprising === true,
  };
}

export const SECTIONS = ['holland', 'bigFive', 'values', 'abilities'] as const;
export type Section = (typeof SECTIONS)[number];
export const isSection = (v: string): v is Section => (SECTIONS as readonly string[]).includes(v);

export interface SectionItem {
  id: string;
  band: Band;
  selfReported?: boolean;
}

/** The entries a section page explains, strongest first where order matters. */
export function sectionItems(view: ProfileView, section: Section): SectionItem[] {
  switch (section) {
    case 'holland': {
      const codeIds = view.types.map((t) => t.id);
      const rest = (RIASEC as readonly Riasec[]).filter((r) => !codeIds.includes(r) && view.interests[r]);
      return [...codeIds, ...rest].map((id) => ({ id, band: view.interests[id]! }));
    }
    case 'bigFive':
      return view.bigFive.map((b) => ({ id: b.trait, band: b.band }));
    case 'values':
      return view.values.map((v) => ({ id: v.value, band: v.band }));
    case 'abilities':
      return view.abilities.map((a) => ({ id: a.domain, band: a.band, selfReported: a.selfReported }));
  }
}

const REASON_FOR: Record<Section, string> = { holland: 'interest', bigFive: 'personality', values: 'value', abilities: 'ability' };

/** Top careers whose fit is backed by this dimension; falls back to the best matches overall. */
export function careersForSection(raw: unknown[], section: Section, lang: Locale, count = 4): { careerId: string; name: string; fit: number }[] {
  const { top } = splitMatches(raw);
  const backed = top.filter((m) => ((m as { reasons?: { kind: string }[] }).reasons ?? []).some((r) => r.kind === REASON_FOR[section]));
  return (backed.length >= 2 ? backed : top).slice(0, count).map((m) => {
    const v = toMatchView(m, lang);
    return { careerId: v.careerId, name: v.name, fit: v.fit };
  });
}
