import { z } from 'zod';

import { READINESS } from './config';

const uuid = z.uuid();
const MAX_UI_BYTES = 4096;

export const contextSchema = z
  .strictObject({
    curriculum: z.enum(['thanaweya', 'igcse', 'american', 'ib', 'other']).nullish(),
    track: z.string().trim().min(1).max(40).nullish(),
    expectedScorePct: z.number().min(0).max(100).nullish(),
    budget: z.enum(['low', 'medium', 'high']).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'at least one field' });

export const startSessionSchema = z.strictObject({
  kind: z.enum(['full', 'quick']).default('full'),
  locale: z.enum(['ar', 'en']).default('ar'),
});

const uiCursor = z
  .record(z.string(), z.unknown())
  .refine((v) => JSON.stringify(v).length <= MAX_UI_BYTES, { message: `cursor larger than ${MAX_UI_BYTES} bytes` });

export const saveResponsesSchema = z.strictObject({
  sessionId: uuid,
  station: z.string().min(1).max(32),
  responses: z
    .array(
      z.strictObject({
        itemId: z.string().min(1).max(80),
        // Range / set membership is checked per item against the instrument; here only "a finite number".
        value: z.number().finite(),
        ms: z.number().int().min(0).max(3_600_000).optional(),
      }),
    )
    .min(1)
    .max(200),
  /** Optional UI resume cursor (item index, card-sort layout...). Stored as-is, size-bounded. */
  cursor: uiCursor.optional(),
});

export const sessionRefSchema = z.strictObject({ sessionId: uuid });

export const saveContextSchema = z.strictObject({ sessionId: uuid, context: contextSchema });

export const completeStationSchema = z.strictObject({
  sessionId: uuid,
  station: z.string().min(1).max(32),
  /** Final "order your top values" step; only meaningful for the values station. */
  valuesRanking: z.array(z.string().min(1).max(40)).max(6).optional(),
});

export const readinessSchema = z.strictObject({
  phase: z.enum(READINESS.phases),
  sessionId: uuid.optional(),
  answers: z.record(z.string().min(1).max(80), z.number().finite()),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type SaveResponsesInput = z.infer<typeof saveResponsesSchema>;
export type SaveContextInput = z.infer<typeof saveContextSchema>;
export type CompleteStationInput = z.infer<typeof completeStationSchema>;
export type ReadinessInput = z.infer<typeof readinessSchema>;
