import { ABILITY_DOMAINS, BIG_FIVE, RIASEC, WORK_VALUES } from '@anabokra/engine';
import { z } from 'zod';

/**
 * The anonymous statistics summary (consent-texts §1.6): one per finished result, sent only with the
 * user's opt-in (the parent's for 15–17). Deliberately coarse: bands instead of scores, top-3 lists,
 * no identifiers, no time. The server accepts exactly these fields and nothing else.
 */

const band = z.enum(['low', 'mid', 'high']);
const bandsOf = <T extends readonly [string, ...string[]]>(keys: T) => z.partialRecord(z.enum(keys), band);

export const statsSummarySchema = z.strictObject({
  v: z.literal(1),
  ageBand: z.enum(['15-17', '18-20', '21-25', '26plus']),
  stage: z.enum(['school', 'university', 'graduate']).nullable(),
  locale: z.enum(['ar', 'en']),
  /** Parts of the assessment that were scored (0–4). */
  completion: z.number().int().min(0).max(4),
  topInterests: z.array(z.enum(RIASEC)).max(3),
  topGroups: z.array(z.string().regex(/^[a-z][a-z0-9_]{1,40}$/)).max(3),
  topValues: z.array(z.enum(WORK_VALUES)).max(3),
  bands: z.strictObject({
    interests: bandsOf(RIASEC),
    personality: bandsOf(BIG_FIVE),
    abilities: bandsOf(ABILITY_DOMAINS),
  }),
  /** Pilot session code, if the user entered one. */
  eventCode: z
    .string()
    .regex(/^[A-Z0-9-]{3,20}$/)
    .nullable(),
});

export type StatsSummary = z.infer<typeof statsSummarySchema>;
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
