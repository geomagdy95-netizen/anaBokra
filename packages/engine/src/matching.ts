import { clamp01, pearson } from './stats';
import {
  ABILITY_DOMAINS,
  BIG_FIVE,
  RIASEC,
  WORK_VALUES,
  type BigFive,
  type CareerForMatching,
  type CareerMatch,
  type ContextFlag,
  type MatchWeights,
  type Reason,
  type UserContext,
  type UserProfile,
  type WatchOut,
} from './types';

/** Starting weights from the spec; to be tuned by the psychologist and pilot data. */
export const DEFAULT_WEIGHTS: MatchWeights = {
  interests: 0.45,
  personality: 0.2,
  values: 0.15,
  abilities: 0.2,
};

/** Tunables kept in one place so the admin panel can expose them later. */
export const MATCH_SETTINGS = {
  /** A trait is "key" for a career when its relevance is in this top percentile of occupations. */
  keyTraitPercentile: 0.75,
  /** Fallback when distinctiveness data is missing: minimum relevance for a key trait. */
  keyTraitRelevance: 0.5,
  /** Ability shortfalls smaller than this (percentile points) are not penalized. */
  abilitySlack: 0.15,
  /** Shortfall that turns into a watch-out. */
  abilityGapWatch: 0.25,
  /** Admission-score margin (percent points) below the typical minimum that still counts as a reach. */
  scoreReachMargin: 0,
};

const isKeyTrait = (career: CareerForMatching, trait: BigFive) => {
  const d = career.traits.personalityDistinct?.[trait];
  return d !== undefined
    ? d >= MATCH_SETTINGS.keyTraitPercentile
    : career.traits.personality[trait] >= MATCH_SETTINGS.keyTraitRelevance;
};

const top = <K extends string>(scores: Record<K, number>, keys: readonly K[], n: number) =>
  [...keys].sort((a, b) => scores[b] - scores[a]).slice(0, n);

// ---------------------------------------------------------------------------
// Components (each returns 0..1 or undefined when data is missing)
// ---------------------------------------------------------------------------

/** Profile correlation between the user's RIASEC scores and the career's interest profile. */
export function interestFit(user: UserProfile['interests'], career: CareerForMatching): number | undefined {
  if (!user) return undefined;
  const r = pearson(
    RIASEC.map((k) => user[k]),
    RIASEC.map((k) => career.traits.riasec[k]),
  );
  return r === null ? 0.5 : (r + 1) / 2;
}

/**
 * Relevance-weighted trait fit. A factor that helps performance (relevance > 0) rewards high
 * scores; one that hurts (relevance < 0) rewards low scores; irrelevant factors are ignored.
 */
export function personalityFit(user: UserProfile['personality'], career: CareerForMatching): number | undefined {
  if (!user) return undefined;
  let num = 0;
  let den = 0;
  for (const t of BIG_FIVE) {
    const rel = career.traits.personality[t];
    const w = Math.abs(rel);
    num += w * (rel >= 0 ? user[t] : 1 - user[t]);
    den += w;
  }
  return den < 1e-9 ? 0.5 : num / den;
}

/** How much the career supplies what the user values (Theory of Work Adjustment correspondence). */
export function valuesFit(user: UserProfile['values'], career: CareerForMatching): number | undefined {
  if (!user) return undefined;
  let num = 0;
  let den = 0;
  for (const v of WORK_VALUES) {
    num += user[v] * career.traits.values[v];
    den += user[v];
  }
  return den < 1e-9 ? 0.5 : num / den;
}

/** Penalizes only shortfalls beyond a slack, weighted by how important each ability is for the career. */
export function abilitiesFit(user: UserProfile['abilities'], career: CareerForMatching): number | undefined {
  if (!user) return undefined;
  let penalty = 0;
  let den = 0;
  for (const d of ABILITY_DOMAINS) {
    const { level, importance } = career.traits.abilities[d];
    penalty += importance * Math.max(0, level - user[d] - MATCH_SETTINGS.abilitySlack);
    den += importance;
  }
  return den < 1e-9 ? 1 : clamp01(1 - penalty / den / (1 - MATCH_SETTINGS.abilitySlack));
}

// ---------------------------------------------------------------------------
// Reasons & watch-outs (structured, so UI/AI can phrase them in AR or EN)
// ---------------------------------------------------------------------------

function reasonsFor(user: UserProfile, career: CareerForMatching): Reason[] {
  const reasons: Reason[] = [];
  const t = career.traits;

  if (user.interests) {
    const userTop = top(user.interests, RIASEC, 3);
    const careerTop = top(t.riasec, RIASEC, 3);
    const shared = userTop.filter((k) => careerTop.includes(k));
    if (shared.length) {
      const strength = shared.reduce((a, k) => a + user.interests![k] * ((t.riasec[k] - 1) / 6), 0) / shared.length;
      reasons.push({ kind: 'interest', types: shared, strength });
    }
  }
  if (user.personality) {
    for (const trait of BIG_FIVE) {
      if (isKeyTrait(career, trait) && user.personality[trait] >= 0.6)
        reasons.push({ kind: 'personality', trait, strength: t.personality[trait] * user.personality[trait] });
    }
  }
  if (user.values) {
    for (const value of top(user.values, WORK_VALUES, 2)) {
      if (t.values[value] >= 0.6) reasons.push({ kind: 'value', value, strength: user.values[value] * t.values[value] });
    }
  }
  if (user.abilities) {
    for (const domain of ABILITY_DOMAINS) {
      const { level, importance } = t.abilities[domain];
      if (importance >= 0.5 && level >= 0.6 && user.abilities[domain] >= level - 0.05)
        reasons.push({ kind: 'ability', domain, strength: importance * user.abilities[domain] });
    }
  }
  return reasons.sort((a, b) => b.strength - a.strength).slice(0, 3);
}

function watchOutsFor(user: UserProfile, career: CareerForMatching): WatchOut[] {
  const out: WatchOut[] = [];
  const t = career.traits;
  if (user.personality) {
    for (const trait of BIG_FIVE) {
      if (isKeyTrait(career, trait) && user.personality[trait] < 0.35)
        out.push({ kind: 'personalityStretch', trait });
    }
  }
  if (user.abilities) {
    for (const domain of ABILITY_DOMAINS) {
      const { level, importance } = t.abilities[domain];
      const gap = level - user.abilities[domain];
      if (importance >= 0.5 && gap >= MATCH_SETTINGS.abilityGapWatch) out.push({ kind: 'abilityGap', domain, gap });
    }
  }
  return out;
}

/**
 * Context never removes a career; it only adds flags the UI explains. School rules (track, expected
 * score) apply at school only; at university or after it, the field of study is compared instead.
 */
export function contextFlags(ctx: UserContext | undefined, career: CareerForMatching): ContextFlag[] {
  const eg = career.egypt;
  if (!ctx || !eg) return [];
  const flags: ContextFlag[] = [];
  const atSchool = ctx.stage === undefined || ctx.stage === 'school';
  if (atSchool) {
    if (ctx.curriculum === 'thanaweya' && ctx.track && eg.tracks?.length && !eg.tracks.includes(ctx.track))
      flags.push('trackMismatch');
    if (
      ctx.expectedScorePct !== undefined &&
      eg.typicalMinScorePct !== undefined &&
      ctx.expectedScorePct < eg.typicalMinScorePct - MATCH_SETTINGS.scoreReachMargin
    )
      flags.push('scoreReach');
  }
  let switching = atSchool;
  if (!atSchool && ctx.field && ctx.field !== 'other' && eg.fields?.length) {
    switching = !eg.fields.includes(ctx.field);
    flags.push(switching ? 'fieldSwitch' : 'fieldMatch');
  }
  // Study costs matter for a route still ahead: at school, or when switching fields.
  if (switching && eg.costLevel === 'high' && ctx.budget && ctx.budget !== 'high') flags.push('costHigh');
  return flags;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface MatchOptions {
  weights?: MatchWeights;
  context?: UserContext;
}

export function matchCareer(
  user: UserProfile,
  career: CareerForMatching,
  { weights = DEFAULT_WEIGHTS, context }: MatchOptions = {},
): CareerMatch {
  const parts = {
    interests: interestFit(user.interests, career),
    personality: personalityFit(user.personality, career),
    values: valuesFit(user.values, career),
    abilities: abilitiesFit(user.abilities, career),
  };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let num = 0;
  let den = 0;
  const components: CareerMatch['components'] = {};
  for (const key of Object.keys(parts) as (keyof MatchWeights)[]) {
    const v = parts[key];
    if (v === undefined) continue;
    components[key] = round1(v * 100);
    num += weights[key] * v;
    den += weights[key];
  }
  return {
    careerId: career.id,
    cluster: career.cluster,
    fit: den > 0 ? round1((num / den) * 100) : 0,
    components,
    coverage: total > 0 ? den / total : 0,
    reasons: reasonsFor(user, career),
    watchOuts: watchOutsFor(user, career),
    flags: contextFlags(context, career),
  };
}

export function rankCareers(user: UserProfile, careers: CareerForMatching[], options: MatchOptions = {}): CareerMatch[] {
  return careers.map((c) => matchCareer(user, c, options)).sort((a, b) => b.fit - a.fit || a.careerId.localeCompare(b.careerId));
}

/**
 * "Surprising matches": strong fits from clusters not represented in the top N,
 * to widen horizons beyond the obvious.
 */
export function surprisingMatches(ranked: CareerMatch[], { top = 5, count = 3, within = 12 } = {}): CareerMatch[] {
  const head = ranked.slice(0, top);
  const cutoff = (head[head.length - 1]?.fit ?? 0) - within;
  const seen = new Set(head.map((m) => m.cluster));
  const out: CareerMatch[] = [];
  for (const m of ranked.slice(top)) {
    if (m.fit < cutoff) break;
    if (seen.has(m.cluster)) continue;
    seen.add(m.cluster);
    out.push(m);
    if (out.length === count) break;
  }
  return out;
}

/** Top-3 RIASEC letters of a career, used for display and quick filters. */
export const careerCode = (career: CareerForMatching): string => top(career.traits.riasec, RIASEC, 3).join('');

const round1 = (x: number) => Math.round(x * 10) / 10;
