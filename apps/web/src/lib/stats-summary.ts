import { ABILITY_DOMAINS, BIG_FIVE, RIASEC, WORK_VALUES } from '@anabokra/engine';
import { z } from 'zod';

/**
 * Anonymous statistics (consent-texts §1.6), sent only with the user's opt-in (feedback: §1.8, sent only
 * when the user presses Send). Kinds of record, none linkable to the others or to the user:
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

const careerId = z.string().regex(/^[a-z][a-z0-9_]{1,60}$/);

/**
 * A journey milestone (docs/product/analytics.md), sent once each: how far people get, for the
 * drop-off between steps. Derived on the phone from what it already stores; carries no time.
 */
export const STEPS = ['discover_task', 'discover_done', 'results_viewed', 'path_started', 'quest_started', 'quest_done', 'career_chosen', 'situation_answered'] as const;
export const statsStepSchema = z.strictObject({
  ...sender,
  kind: z.literal('step'),
  step: z.enum(STEPS),
  /** The task number for discover_task. */
  n: z.number().int().min(1).max(10).nullable(),
  group: groupId.nullable(),
  career: careerId.nullable(),
});

/** A career page opened (once per career per phone): which careers people are curious about. */
export const statsViewSchema = z.strictObject({
  ...sender,
  kind: z.literal('view'),
  career: careerId,
});

/** What people use on the map and pages, counted on the phone and sent at most once a day. */
export const USAGE_ACTIONS = [
  'map_island',
  'map_core',
  'map_career',
  'map_search',
  'map_list',
  'map_zoom',
  'map_arrange',
  'map_hint_closed',
  'dock_island',
  'dock_results',
  'dock_careers',
  'dock_fields',
  'next_pill',
  'career_tab',
  'career_fact',
  'myth_open',
  'hurdle_source',
  'share',
  'results_tab',
  'match_details',
] as const;
export type UsageAction = (typeof USAGE_ACTIONS)[number];
export const statsUsageSchema = z.strictObject({
  ...sender,
  kind: z.literal('usage'),
  counts: z.partialRecord(z.enum(USAGE_ACTIONS), z.number().int().min(1).max(1000)),
});

/** Where feedback was given, and the choices it offers. */
export const FEEDBACK_SCREENS = ['results', 'career', 'map', 'account', 'path'] as const;
export const FEEDBACK_PARTS = ['map', 'tasks', 'games', 'paths', 'quests', 'careers', 'hurdles', 'results'] as const;

/**
 * Feedback the user chose to send (a separate, explicit action; not tied to the statistics switch).
 * Free text is cleaned on the phone and again on the server; see cleanFeedbackText.
 */
export const statsFeedbackSchema = z.strictObject({
  ...sender,
  kind: z.literal('feedback'),
  screen: z.enum(FEEDBACK_SCREENS),
  /** The career page it was given on, for screen "career". */
  career: careerId.nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  liked: z.array(z.enum(FEEDBACK_PARTS)).max(FEEDBACK_PARTS.length),
  confusing: z.array(z.enum(FEEDBACK_PARTS)).max(FEEDBACK_PARTS.length),
  text: z.string().max(500).nullable(),
});

/**
 * Strips what could identify someone from free text: e-mail addresses, links, @handles and long
 * digit runs (phone or ID numbers, Arabic digits too), then trims to 500 characters.
 */
export function cleanFeedbackText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[…]')
    .replace(/(https?:\/\/|www\.)\S+/gi, '[…]')
    .replace(/(^|\s)@[\w.]{2,}/g, '$1[…]')
    .replace(/[0-9\u0660-\u0669\u06F0-\u06F9][0-9\u0660-\u0669\u06F0-\u06F9\s\-().+]{5,}[0-9\u0660-\u0669\u06F0-\u06F9]/g, '[…]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
  return t || null;
}

/** Anything the phone may send to /api/stats. */
export const statsUploadSchema = z.union([statsSummarySchema, statsPathSchema, statsRatingSchema, statsGameSchema, statsStepSchema, statsViewSchema, statsUsageSchema, statsFeedbackSchema]);

export type StatsSummary = z.infer<typeof statsSummarySchema>;
export type StatsPath = z.infer<typeof statsPathSchema>;
export type StatsRating = z.infer<typeof statsRatingSchema>;
export type StatsGame = z.infer<typeof statsGameSchema>;
export type StatsStep = z.infer<typeof statsStepSchema>;
export type StatsView = z.infer<typeof statsViewSchema>;
export type StatsUsage = z.infer<typeof statsUsageSchema>;
export type StatsFeedback = z.infer<typeof statsFeedbackSchema>;
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
