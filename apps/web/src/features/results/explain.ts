import { explainMatches, templateExplanation, type CareerExplanation, type ExplainCareer, type ExplainInput, type Gender } from '@anabokra/ai';
import { careers } from '@anabokra/content';
import type { CareerMatch } from '@anabokra/engine';

/** AI wording only when explicitly switched on AND a key exists; everything else is deterministic templates. */
export function resolveExplainMode(env: Record<string, string | undefined> = process.env): 'ai' | 'template' {
  return env.ANABOKRA_AI_MODE === 'ai' && Boolean(env.ANTHROPIC_API_KEY?.trim()) ? 'ai' : 'template';
}

export const genderOf = (g: 'female' | 'male' | null | undefined): Gender => (g === 'female' || g === 'male' ? g : 'neutral');

/** explainMatches, but any failure (network, bad key, bug) falls back to the deterministic templates. */
export async function safeExplain(
  input: Omit<ExplainInput, 'mode'> & { mode?: ExplainInput['mode'] },
  explain: (i: ExplainInput) => Promise<CareerExplanation[]> = explainMatches,
): Promise<CareerExplanation[]> {
  const mode = input.mode ?? resolveExplainMode();
  try {
    return await explain({ ...input, mode });
  } catch {
    const byId = new Map(input.careers.map((c) => [c.id, c]));
    return input.matches.map((m) => templateExplanation(m, byId.get(m.careerId), input.locale, input.gender));
  }
}

export const explainCareers = (): ExplainCareer[] => careers;
export type { CareerMatch };
