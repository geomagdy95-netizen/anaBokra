import { vi } from 'vitest';
import type { CareerMatch } from '@anabokra/engine';
import type { ExplainCareer, MessagesClient } from '../src';

export const careers: ExplainCareer[] = [
  {
    id: 'accountant',
    name: { en: 'Accountant', ar: 'محاسب' },
    snapshot: {
      hook: { en: 'You are the person who knows where the money really went.', ar: 'أنت الشخص الذي يعرف أين ذهبت الفلوس فعلًا.' },
    },
  },
  { id: 'architect', name: { en: 'Architect', ar: 'مهندس معماري' } },
  { id: 'psych', name: { en: 'Clinical Psychologist', ar: 'أخصائي نفسي إكلينيكي' } },
];

export const fullMatch: CareerMatch = {
  careerId: 'accountant',
  cluster: 'business',
  fit: 78,
  components: { interests: 80 },
  coverage: 1,
  reasons: [
    { kind: 'interest', types: ['C', 'I'], strength: 0.9 },
    { kind: 'personality', trait: 'conscientiousness', strength: 0.7 },
    { kind: 'value', value: 'workingConditions', strength: 0.6 },
    { kind: 'ability', domain: 'numerical', strength: 0.8 },
  ],
  watchOuts: [
    { kind: 'personalityStretch', trait: 'extraversion' },
    { kind: 'abilityGap', domain: 'verbal', gap: 0.3 },
  ],
  flags: ['trackMismatch', 'scoreReach', 'costHigh'],
};

export const plainMatch = (careerId: string, fit = 70): CareerMatch => ({
  careerId,
  cluster: 'x',
  fit,
  components: {},
  coverage: 1,
  reasons: [
    { kind: 'interest', types: ['A'], strength: 0.8 },
    { kind: 'ability', domain: 'creative', strength: 0.7 },
  ],
  watchOuts: [],
  flags: [],
});

export const GOOD_EN = 'Your steady attention to detail is a real strength here. This career rewards people who like keeping things in order. It is a great place to build on what you already do well.';
export const GOOD_AR = 'اهتمامك بالتفاصيل ميزة حقيقية في هذه المهنة. وهي مناسبة لمن يحب التنظيم والدقة. يمكنك البناء على ما تتقنه بالفعل.';

/** Mock Anthropic client returning the given text blocks in order (last one repeats). */
export function mockClient(texts: string[], usage = { input_tokens: 900, output_tokens: 120 }) {
  let i = 0;
  const create = vi.fn(async () => {
    const text = texts[Math.min(i++, texts.length - 1)]!;
    return {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-5-5',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text }],
      usage: { cache_read_input_tokens: 0, cache_creation_input_tokens: 0, ...usage },
    };
  });
  return { client: { messages: { create } } as unknown as MessagesClient, create };
}

export const aiJson = (entries: Record<string, string>) =>
  JSON.stringify({ explanations: Object.entries(entries).map(([careerId, text]) => ({ careerId, text })) });
