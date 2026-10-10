import { careers as allCareers } from '@anabokra/content';
import {
  checkQuality,
  interestProfile,
  personalityProfile,
  rankCareers,
  scoreAbilities,
  scoreLikert,
  scoreValues,
  surprisingMatches,
  WORK_VALUES,
  type CareerForMatching,
  type CareerMatch,
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

export function scorePersonality(responses: ResponseRecord[]) {
  const rs = inInstrumentOrder('personality', forInstrument(responses, 'personality'));
  return personalityProfile(scoreLikert(likert('personality'), rs));
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
  const personality = scorePersonality(responses);
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
