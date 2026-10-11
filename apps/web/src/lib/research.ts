import { STAGES, WORK_VALUES } from '@anabokra/engine';
import { z } from 'zod';

/**
 * Pilot sessions and the research opt-in (consent-texts §2.2–2.3, pilot-plan "Data"). Shared by the
 * phone, which builds the uploads, and the server, which accepts exactly these fields.
 *
 * - Answer sets: one per finished result, with no name, no ID and no key; tagged only with the event
 *   code, age band, stage and language. They cannot be linked to anything else.
 * - Readiness records: the "how ready do you feel" answers, tagged with a random link code made on the
 *   phone so the before and after answers can be paired. The link code is never on an answer set.
 */

/** Partner session codes, e.g. "CU-FCI-1". */
export const EVENT_CODE = /^[A-Z0-9][A-Z0-9-]{2,19}$/;

/** Upper-cases, trims and turns Arabic-Indic digits and spaces into a code; null if it can't be one. */
export function normalizeEventCode(raw: string): string | null {
  const s = raw
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\s_]+/g, '-')
    .toUpperCase();
  return EVENT_CODE.test(s) ? s : null;
}

/** 26 Crockford base32 characters = 130 random bits. */
export const LINK_CODE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Research data is deleted once the analysis is done, and no later than this date (pilot plan). */
export const RESEARCH_DELETE_BY = '2027-06-17';

const eventCode = z.string().regex(EVENT_CODE);
const answers = z.record(z.string().regex(/^[A-Za-z0-9_]{1,40}$/), z.number().int().min(0).max(100));

export const researchAnswerSetSchema = z.strictObject({
  v: z.literal(1),
  eventCode,
  /** Research is for adults only. */
  ageBand: z.enum(['18-20', '21-25', '26plus']),
  stage: z.enum(STAGES).nullable(),
  locale: z.enum(['ar', 'en']),
  /** Instrument versions the answers were given on. */
  versions: z.partialRecord(z.enum(['interests', 'personality', 'values', 'abilities']), z.string().max(32)),
  answers: z.partialRecord(z.enum(['interests', 'personality', 'values', 'abilities']), answers),
  valuesRanking: z.array(z.enum(WORK_VALUES)).max(WORK_VALUES.length),
});

export const researchReadinessSchema = z.strictObject({
  v: z.literal(1),
  eventCode,
  linkCode: z.string().regex(LINK_CODE),
  /** 'pre' = before the assessment (baseline); 'post' = after the results. */
  phase: z.enum(['pre', 'post']),
  version: z.string().max(32),
  locale: z.enum(['ar', 'en']),
  answers,
});

export const researchForgetSchema = z.strictObject({ linkCode: z.string().regex(LINK_CODE) });

export type ResearchAnswerSet = z.infer<typeof researchAnswerSetSchema>;
export type ResearchReadiness = z.infer<typeof researchReadinessSchema>;
