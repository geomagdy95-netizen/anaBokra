import Anthropic from '@anthropic-ai/sdk';
import type { CareerMatch } from '@anabokra/engine';
import { z } from 'zod';
import { OUTPUT_JSON_SCHEMA, SYSTEM_PROMPT, buildUserPayload } from './prompt';
import type { ExplainCareer, Gender, Locale, MessagesClient, UsageRecord } from './types';

export const DEFAULT_MODEL = 'claude-sonnet-5-5';
export const MAX_OUTPUT_TOKENS = 4096;

export const modelFromEnv = () => process.env.ANABOKRA_AI_MODEL?.trim() || DEFAULT_MODEL;

export const ModelOutputSchema = z.object({
  explanations: z.array(z.object({ careerId: z.string().min(1), text: z.string() })),
});

let sharedClient: MessagesClient | null | undefined;

/** Default client: reads ANTHROPIC_API_KEY (or other SDK-supported credentials). Returns null if unusable. */
export function defaultClient(): MessagesClient | null {
  if (sharedClient !== undefined) return sharedClient;
  try {
    sharedClient = new Anthropic({ timeout: 30_000, maxRetries: 1 }) as unknown as MessagesClient;
  } catch {
    sharedClient = null;
  }
  return sharedClient;
}

export class AiGenerationError extends Error {}

export interface GenerateArgs {
  client: MessagesClient;
  model: string;
  matches: CareerMatch[];
  careers: ExplainCareer[];
  locale: Locale;
  gender: Gender;
  resultId: string;
  onUsage?: (u: UsageRecord) => void | Promise<void>;
}

/** One model call for a batch of careers. Returns careerId -> raw text (not yet guardrail-checked). */
export async function generateTexts(a: GenerateArgs): Promise<Map<string, string>> {
  const started = Date.now();
  const response = await a.client.messages.create({
    model: a.model,
    max_tokens: MAX_OUTPUT_TOKENS,
    // Static prompt first with a cache breakpoint; the per-request payload follows in the user turn.
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildUserPayload(a.matches, a.careers, a.locale, a.gender) }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_JSON_SCHEMA } },
  });

  if (a.onUsage) {
    const u = response.usage;
    const record: UsageRecord = {
      model: response.model ?? a.model,
      inputTokens: u?.input_tokens ?? 0,
      outputTokens: u?.output_tokens ?? 0,
      cacheReadTokens: u?.cache_read_input_tokens ?? 0,
      cacheCreationTokens: u?.cache_creation_input_tokens ?? 0,
      resultId: a.resultId,
      careerIds: a.matches.map((m) => m.careerId),
      locale: a.locale,
      latencyMs: Date.now() - started,
    };
    try {
      await a.onUsage(record);
    } catch {
      /* logging must never break explanations */
    }
  }

  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
    throw new AiGenerationError(`stop_reason:${response.stop_reason}`);
  }
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new AiGenerationError('no_text');

  let json: unknown;
  try {
    json = JSON.parse(stripFences(textBlock.text));
  } catch {
    throw new AiGenerationError('malformed_json');
  }
  const parsed = ModelOutputSchema.safeParse(json);
  if (!parsed.success) throw new AiGenerationError('schema_mismatch');

  const wanted = new Set(a.matches.map((m) => m.careerId));
  const out = new Map<string, string>();
  for (const e of parsed.data.explanations) {
    if (wanted.has(e.careerId) && !out.has(e.careerId)) out.set(e.careerId, e.text.trim());
  }
  return out;
}

function stripFences(s: string): string {
  const t = s.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(t);
  return m ? m[1]! : t;
}
