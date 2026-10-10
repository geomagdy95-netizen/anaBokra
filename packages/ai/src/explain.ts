import { defaultClient, generateTexts, modelFromEnv } from './ai';
import { PROMPT_VERSION, cacheKey, defaultCache } from './cache';
import { checkText } from './guardrails';
import { templateExplanation } from './templates';
import type { CareerExplanation, ExplainInput } from './types';

/** Careers per AI call (the top of the ranking). The rest always get template text. */
export const AI_TOP_N = 5;

export const engineVersionFromEnv = () => process.env.ANABOKRA_ENGINE_VERSION?.trim() || 'engine-0';

/**
 * Turn engine matches into short AR/EN explanations. Scores are never read for wording beyond a coarse
 * opener and are never modified. `template` is deterministic; `ai` enhances the top matches and falls back
 * to templates on any failure (network, refusal, malformed JSON, guardrail violation).
 */
export async function explainMatches(input: ExplainInput): Promise<CareerExplanation[]> {
  const { matches, careers, locale, gender, mode, resultId } = input;
  const deps = input.deps ?? {};
  const byId = new Map(careers.map((c) => [c.id, c]));

  const results = matches.map((m) => templateExplanation(m, byId.get(m.careerId), locale, gender));
  if (mode !== 'ai') return results;

  const cache = deps.cache ?? defaultCache;
  const engineVersion = deps.engineVersion ?? engineVersionFromEnv();
  const top = matches.slice(0, AI_TOP_N);
  const allNames = careers.flatMap((c) => [c.name.en, c.name.ar]);

  const keyOf = (careerId: string) =>
    cacheKey({ resultId, careerId, locale, gender, engineVersion, promptVersion: PROMPT_VERSION });
  const apply = (careerId: string, text: string, source: 'ai' | 'cache') => {
    const r = results.find((x) => x.careerId === careerId);
    if (r) {
      r.text = text;
      r.source = source;
    }
  };

  // 1. Cache.
  const misses = [];
  for (const m of top) {
    let cached: string | undefined;
    try {
      cached = await cache.get(keyOf(m.careerId));
    } catch {
      cached = undefined;
    }
    if (cached && checkText(cached, locale, allNames).ok) apply(m.careerId, cached, 'cache');
    else misses.push(m);
  }
  if (misses.length === 0) return results;

  // 2. One model call for everything that is not cached.
  const client = deps.client ?? defaultClient();
  if (!client) return results;
  let texts: Map<string, string>;
  try {
    texts = await generateTexts({
      client,
      model: deps.model ?? modelFromEnv(),
      matches: misses,
      careers,
      locale,
      gender,
      resultId,
      onUsage: deps.onUsage,
    });
  } catch {
    return results;
  }

  // 3. Guardrails per career; failures keep the template text.
  for (const m of misses) {
    const text = texts.get(m.careerId);
    if (!text || !checkText(text, locale, allNames).ok) continue;
    apply(m.careerId, text, 'ai');
    try {
      await cache.set(keyOf(m.careerId), text);
    } catch {
      /* cache failures are non-fatal */
    }
  }
  return results;
}
