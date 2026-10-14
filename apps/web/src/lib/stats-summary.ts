import { ABILITY_DOMAINS, BIG_FIVE, RIASEC, WORK_VALUES } from '@anabokra/engine';
import { z } from 'zod';

/**
 * Anonymous statistics (consent-texts §1.6), sent only with the user's opt-in. Three kinds of record,
 * none linkable to the others or to the user:
 * - the summary: one per finished result. Deliberately coarse: bands instead of scores, top-3 lists;
 * - a checked path: one per path the user verified (its first result), with its band only;
 * - the results rating: "my results were clear and useful", 1–5, once (pilot plan §7).
 * No identifiers, no time. The server accepts exactly these fields and nothing else.
 */

const band = z.enum(['low', 'mid', 'high']);
const bandsOf = <T extends readonly [string, ...string[]]>(keys: T) => z.partialRecord(z.enum(keys), band);
const groupId = z.string().regex(/^[a-z][a-z0-9_]{1,40}$/);

/** Who sent it, as coarsely as the summary says it. */
const sender = {
  v: z.literal(1),
  ageBand: z.enum(['15-17', '18-20', '21-25', '26plus']),
  stage: z.enum(['school', 'university', 'graduate']).nullable(),
  locale: z.enum(['ar', 'en']),
  /** Pilot session code, if the user entered one. */
  eventCode: z
    .string()
    .regex(/^[A-Z0-9-]{3,20}$/)
    .nullable(),
};

export const statsSummarySchema = z.strictObject({
  ...sender,
  /** Parts of the assessment that were scored (0–4). */
  completion: z.number().int().min(0).max(4),
  topInterests: z.array(z.enum(RIASEC)).max(3),
  topGroups: z.array(groupId).max(3),
  topValues: z.array(z.enum(WORK_VALUES)).max(3),
  bands: z.strictObject({
    interests: bandsOf(RIASEC),
    personality: bandsOf(BIG_FIVE),
    abilities: bandsOf(ABILITY_DOMAINS),
  }),
});

export const statsPathSchema = z.strictObject({
  ...sender,
  kind: z.literal('path'),
  group: groupId,
  band: z.enum(['fitsWell', 'fitsPartly', 'rethink']),
});

export const statsRatingSchema = z.strictObject({
  ...sender,
  kind: z.literal('rating'),
  rating: z.number().int().min(1).max(5),
});

/**
 * A game score, for the comparison with other players (docs/product/games.md): the game, its
 * version (scores of different versions aren't compared) and the points. First play only.
 */
export const statsGameSchema = z.strictObject({
  ...sender,
  kind: z.literal('game'),
  game: z.enum(['pattern', 'numbers', 'rotation', 'memory']),
  gameVersion: z.literal(1),
  score: z.number().int().min(0).max(20),
});

/** Anything the phone may send to /api/stats. */
export const statsUploadSchema = z.union([statsSummarySchema, statsPathSchema, statsRatingSchema, statsGameSchema]);

export type StatsSummary = z.infer<typeof statsSummarySchema>;
export type StatsPath = z.infer<typeof statsPathSchema>;
export type StatsRating = z.infer<typeof statsRatingSchema>;
export type StatsGame = z.infer<typeof statsGameSchema>;
export type StatsUpload = z.infer<typeof statsUploadSchema>;
export type StatsSender = Pick<StatsSummary, 'v' | 'ageBand' | 'stage' | 'locale' | 'eventCode'>;
export type StatsBand = z.infer<typeof band>;

export const toBand = (v: number): StatsBand => (v < 1 / 3 ? 'low' : v < 2 / 3 ? 'mid' : 'high');

type Scores = Record<string, unknown>;

function bands<K extends string>(keys: readonly K[], scores: unknown): Partial<Record<K, StatsBand>> {
  const s = (scores && typeof scores === 'object' ? scores : {}) as Scores;
  const out: Partial<Record<K, StatsBand>> = {};
  for (const k of keys) if (typeof s[k] === 'number' && Number.isFinite(s[k])) out[k] = toBand(s[k]);
  return out;
}

function top<K extends string>(keys: readonly K[], scores: unknown, n = 3): K[] {
  const s = (scores && typeof scores === 'object' ? scores : {}) as Scores;
  return keys
    .filter((k) => typeof s[k] === 'number')
    .sort((a, b) => (s[b] as number) - (s[a] as number))
    .slice(0, n);
}

export interface SummaryInput {
  result: { scores: Record<string, unknown>; matches: unknown[] };
  ageBand: StatsSummary['ageBand'];
  stage: StatsSummary['stage'];
  locale: StatsSummary['locale'];
  eventCode?: string | null;
}

/** Builds the summary from a stored result. Pure: no ids, names or times from the input survive. */
export function buildStatsSummary({ result, ageBand, stage, locale, eventCode = null }: SummaryInput): StatsSummary {
  const derived = (result.scores.derived ?? {}) as { scoredStations?: unknown; valuesRanking?: unknown };
  const scored = Array.isArray(derived.scoredStations) ? derived.scoredStations.length : 0;
  const ranking = Array.isArray(derived.valuesRanking) ? (derived.valuesRanking as string[]) : [];
  const groups: string[] = [];
  for (const m of result.matches as { cluster?: unknown }[]) {
    if (typeof m?.cluster === 'string' && !groups.includes(m.cluster)) groups.push(m.cluster);
    if (groups.length === 3) break;
  }
  return statsSummarySchema.parse({
    v: 1,
    ageBand,
    stage,
    locale,
    completion: Math.min(4, scored),
    topInterests: top(RIASEC, result.scores.interests),
    topGroups: groups,
    topValues: ranking.filter((v): v is (typeof WORK_VALUES)[number] => (WORK_VALUES as readonly string[]).includes(v)).slice(0, 3),
    bands: {
      interests: bands(RIASEC, result.scores.interests),
      personality: bands(BIG_FIVE, result.scores.personality),
      abilities: bands(ABILITY_DOMAINS, result.scores.abilities),
    },
    eventCode: eventCode ? eventCode.toUpperCase() : null,
  });
}
