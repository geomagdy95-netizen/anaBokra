import { careers as allCareers, personalityShort } from '@anabokra/content';
import {
  checkQuality,
  interestProfile,
  personalityProfile,
  rankCareers,
  rankGroups,
  scoreAbilities,
  scoreLikert,
  scoreValues,
  surprisingMatches,
  WORK_VALUES,
  type CareerForMatching,
  type CareerMatch,
  type GroupRank,
  type ItemResponse,
  type UserContext,
  type UserProfile,
  type ValueBucket,
  type WorkValue,
} from '@anabokra/engine';

import {
  abilitiesInstrument,
  ASSESSMENT_VERSION,
  ENGINE_VERSION,
  likert,
  NORMS_VERSION,
  SURPRISING_MATCHES,
  TOP_MATCHES,
  valuesInstrument,
  currentInstrumentVersions,
} from './config';
import type { Json, NewResult, ResponseRecord } from './types';

const forInstrument = (responses: ResponseRecord[], instrumentId: string): ItemResponse[] =>
  responses
    .filter((r) => r.instrumentId === instrumentId)
    .map((r) => ({ itemId: r.itemId, value: r.value, ...(r.ms !== null ? { ms: r.ms } : {}) }));

/** Likert responses in instrument order, so quality checks (runs, timing) do not depend on DB row order. */
function inInstrumentOrder(instrumentId: 'interests' | 'personality', rs: ItemResponse[]): ItemResponse[] {
  const byId = new Map(rs.map((r) => [r.itemId, r]));
  return likert(instrumentId).items.flatMap((i) => {
    const r = byId.get(i.id);
    return r ? [r] : [];
  });
}

export function scoreInterests(responses: ResponseRecord[]) {
  const rs = inInstrumentOrder('interests', forInstrument(responses, 'interests'));
  return interestProfile(scoreLikert(likert('interests'), rs));
}

/** Which personality set the scores rest on: all 50 statements, or the 20 of the short set (Discover). */
export type PersonalitySet = 'full' | 'short';

export function scorePersonalityWithSet(responses: ResponseRecord[]): { scores: ReturnType<typeof personalityProfile>; set: PersonalitySet } | undefined {
  const rs = inInstrumentOrder('personality', forInstrument(responses, 'personality'));
  const full = personalityProfile(scoreLikert(likert('personality'), rs));
  if (full) return { scores: full, set: 'full' };
  // Discover asks only the short set; score it when the full set isn't answered.
  const short = personalityProfile(scoreLikert(personalityShort(), rs));
  return short ? { scores: short, set: 'short' } : undefined;
}

export function scorePersonality(responses: ResponseRecord[]) {
  return scorePersonalityWithSet(responses)?.scores;
}

export function scoreValueCards(responses: ResponseRecord[], ranking?: string[]) {
  const inst = valuesInstrument();
  const bucketByWeight = new Map(inst.buckets.map((b) => [b.weight, b.id]));
  const placements: Record<string, ValueBucket> = {};
  for (const r of forInstrument(responses, 'values')) {
    const b = bucketByWeight.get(r.value);
    if (b) placements[r.itemId] = b;
  }
  const valid = (ranking ?? []).filter((v): v is WorkValue => (WORK_VALUES as readonly string[]).includes(v));
  return scoreValues(inst, placements, valid.length ? valid : undefined);
}

export function scoreAbilityStation(responses: ResponseRecord[]) {
  const inst = abilitiesInstrument();
  const rs = forInstrument(responses, 'abilities');
  const selfIds = new Set(inst.selfRatings.map((s) => s.id));
  return scoreAbilities(
    inst,
    rs.filter((r) => selfIds.has(r.itemId)),
    rs.filter((r) => !selfIds.has(r.itemId)).map((r) => ({ itemId: r.itemId, choice: r.value })),
  );
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

export interface ScoreSessionInput {
  userId: string;
  sessionId: string;
  responses: ResponseRecord[];
  valuesRanking?: string[];
  context?: UserContext;
  careers?: CareerForMatching[];
  /** Instrument versions pinned on the session (stored in the result for traceability). */
  instrumentVersions?: Record<string, string>;
}

/**
 * Pure server-side scoring of a session: engine scores, quality flags and career matches.
 * Returns undefined when no station could be scored at all.
 */
export function scoreSession(input: ScoreSessionInput): NewResult | undefined {
  const { responses, context = {}, careers = allCareers } = input;
  const interests = scoreInterests(responses);
  const personalityScored = scorePersonalityWithSet(responses);
  const personality = personalityScored?.scores;
  const values = scoreValueCards(responses, input.valuesRanking);
  const abilities = scoreAbilityStation(responses);
  if (!interests && !personality && !values && !abilities) return undefined;

  const profile: UserProfile = {
    ...(interests ? { interests: interests.scores } : {}),
    ...(personality ? { personality } : {}),
    ...(values ? { values: values.scores } : {}),
    ...(abilities ? { abilities: abilities.scores } : {}),
  };
  const ranked = rankCareers(profile, careers, { context });
  const top = ranked.slice(0, TOP_MATCHES);
  const topIds = new Set(top.map((m) => m.careerId));
  const surprising = surprisingMatches(ranked, { count: SURPRISING_MATCHES });
  const rankOf = new Map(ranked.map((m, i) => [m.careerId, i + 1]));
  const surprisingIds = new Set(surprising.map((m) => m.careerId));
  // A surprising match that is also in the top N is stored once, as 'top' flagged `surprising`.
  const matches: StoredMatch[] = [
    ...top.map((m) => ({
      ...m,
      rank: rankOf.get(m.careerId)!,
      kind: 'top' as const,
      ...(surprisingIds.has(m.careerId) ? { surprising: true as const } : {}),
    })),
    ...surprising
      .filter((m) => !topIds.has(m.careerId))
      .map((m) => ({ ...m, rank: rankOf.get(m.careerId)!, kind: 'surprising' as const, surprising: true as const })),
  ];

  // Quality: per Likert instrument, flags merged. Flags never block a result.
  const qualityOf = (id: 'interests' | 'personality') => {
    const rs = inInstrumentOrder(id, forInstrument(responses, id));
    return rs.length ? checkQuality(likert(id), rs) : undefined;
  };
  const qi = qualityOf('interests');
  const qp = qualityOf('personality');
  const flags = [...new Set([...(qi?.flags ?? []), ...(qp?.flags ?? [])])].sort();
  const quality: Json = { flags, ...(qi ? { interests: qi } : {}), ...(qp ? { personality: qp } : {}) };

  const coverage = round3(ranked[0]?.coverage ?? 0);
  const kindHasAllStations = Boolean(interests && personality && values && abilities);
  const clusters: string[] = [];
  for (const m of ranked.slice(0, 10)) if (!clusters.includes(m.cluster) && clusters.length < 3) clusters.push(m.cluster);

  const versions = input.instrumentVersions ?? currentInstrumentVersions('full');
  return {
    userId: input.userId,
    sessionId: input.sessionId,
    assessmentVersion: ASSESSMENT_VERSION,
    engineVersion: ENGINE_VERSION,
    normsVersion: NORMS_VERSION,
    scores: {
      ...(interests ? { interests: interests.scores } : {}),
      ...(personality ? { personality } : {}),
      ...(values ? { values: values.scores } : {}),
      ...(abilities ? { abilities: abilities.scores } : {}),
      derived: {
        ...(interests
          ? { hollandCode: interests.code, differentiation: interests.differentiation, consistency: interests.consistency }
          : {}),
        ...(values ? { valuesRanking: values.ranking } : {}),
        ...(abilities ? { abilityBasis: abilities.basis } : {}),
        ...(personalityScored ? { personalitySet: personalityScored.set } : {}),
        instrumentVersions: versions,
        scoredStations: [
          ...(interests ? ['interests'] : []),
          ...(personality ? ['personality'] : []),
          ...(values ? ['values'] : []),
          ...(abilities ? ['abilities'] : []),
        ],
      },
    },
    matches,
    context,
    coverage,
    quality,
    summary: {
      ...(interests ? { hollandCode: interests.code } : {}),
      topClusters: clusters,
      topCareerIds: ranked.slice(0, 5).map((m) => m.careerId),
      coverage,
      partial: !kindHasAllStations,
    },
  };
}

export type StoredMatch = CareerMatch & { rank: number; kind: 'top' | 'surprising'; surprising?: true };

// ---------------------------------------------------------------------------
// Discover: live path suggestions while the answers come in (nothing is stored)
// ---------------------------------------------------------------------------

/** How far suggestions have got: nothing yet, an early guess from a few interests, or suggestions. */
export type PreviewStage = 'none' | 'early' | 'suggested';

export interface Preview {
  stage: PreviewStage;
  /** Career groups ("paths"), best first. */
  groups: GroupRank[];
  /** The best careers so far. */
  matches: CareerMatch[];
  /** Interest type codes, strongest first (e.g. ["I", "A", "S"]). */
  interestCode: string[];
  personalitySet: PersonalitySet | null;
  /**
   * The interest answers are so even that no type stands out, so the path ranking means little.
   * The UI says so instead of listing paths.
   */
  flat: boolean;
}

/** Below this spread between the strongest and weakest interest type (0–1), no path stands out. */
export const FLAT_INTERESTS = 0.1;

/** An early guess needs 4 of the 10 activities of each interest type (after Discover task 4). */
export const EARLY_GUESS_COVERAGE = 0.4;

/**
 * Scores what has been answered so far and ranks the paths. With interests at 80% coverage the
 * stage is "suggested"; with fewer (but at least EARLY_GUESS_COVERAGE) it is an "early" guess built
 * from interests only, to be labelled as such. Pure and fast enough to run after every task.
 */
export function previewSuggestions(
  responses: ResponseRecord[],
  { valuesRanking, context, careers = allCareers }: { valuesRanking?: string[]; context?: UserContext; careers?: CareerForMatching[] } = {},
): Preview {
  const interests = scoreInterests(responses);
  const empty: Preview = { stage: 'none', groups: [], matches: [], interestCode: [], personalitySet: null, flat: false };
  if (!interests) {
    const rs = inInstrumentOrder('interests', forInstrument(responses, 'interests'));
    const early = interestProfile(scoreLikert(likert('interests'), rs, undefined, { minCoverage: EARLY_GUESS_COVERAGE }));
    if (!early) return empty;
    const ranked = rankCareers({ interests: early.scores }, careers, { context });
    return {
      stage: 'early',
      groups: rankGroups(ranked),
      matches: ranked.slice(0, 5),
      interestCode: early.code.split(''),
      personalitySet: null,
      flat: early.differentiation < FLAT_INTERESTS,
    };
  }
  const personality = scorePersonalityWithSet(responses);
  const abilities = scoreAbilityStation(responses);
  const values = scoreValueCards(responses, valuesRanking);
  const profile: UserProfile = {
    interests: interests.scores,
    ...(personality ? { personality: personality.scores } : {}),
    ...(values ? { values: values.scores } : {}),
    ...(abilities ? { abilities: abilities.scores } : {}),
  };
  const ranked = rankCareers(profile, careers, { context });
  return {
    stage: 'suggested',
    groups: rankGroups(ranked),
    matches: ranked.slice(0, 5),
    interestCode: interests.code.split(''),
    personalitySet: personality?.set ?? null,
    flat: interests.differentiation < FLAT_INTERESTS,
  };
}
