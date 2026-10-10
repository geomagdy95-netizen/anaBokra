import { templateExplanation, type CareerExplanation } from '@anabokra/ai';
import { careers } from '@anabokra/content';
import type { CareerMatch } from '@anabokra/engine';
import { describe, expect, it } from 'vitest';

import { resolveExplainMode, safeExplain } from './explain';
import { loadResultView } from './load';

const match = (id: string): CareerMatch => ({
  careerId: id,
  cluster: careers.find((c) => c.id === id)?.cluster ?? 'x',
  fit: 80,
  components: {},
  coverage: 1,
  reasons: [{ kind: 'interest', types: ['I'], strength: 0.9 }],
  watchOuts: [],
  flags: [],
});
const ids = careers.slice(0, 3).map((c) => c.id);

describe('explanations', () => {
  it('uses AI only with ANABOKRA_AI_MODE=ai and a key', () => {
    expect(resolveExplainMode({})).toBe('template');
    expect(resolveExplainMode({ ANABOKRA_AI_MODE: 'ai' })).toBe('template');
    expect(resolveExplainMode({ ANTHROPIC_API_KEY: 'k' })).toBe('template');
    expect(resolveExplainMode({ ANABOKRA_AI_MODE: 'ai', ANTHROPIC_API_KEY: 'k' })).toBe('ai');
  });

  it('template mode needs no key and labels its source', async () => {
    const out = await safeExplain({ matches: ids.map(match), careers, locale: 'en', gender: 'neutral', resultId: 'r1', mode: 'template' });
    expect(out).toHaveLength(3);
    expect(out.every((e) => e.source === 'template' && e.text.length > 0)).toBe(true);
  });

  it('falls back to templates when the explainer throws', async () => {
    const boom = async (): Promise<CareerExplanation[]> => {
      throw new Error('network down');
    };
    const out = await safeExplain({ matches: ids.map(match), careers, locale: 'ar', gender: 'female', resultId: 'r1', mode: 'ai' }, boom);
    const expected = templateExplanation(match(ids[0]!), careers[0], 'ar', 'female');
    expect(out[0]!.source).toBe('template');
    expect(out[0]!.text).toBe(expected.text);
  });

  it('AI mode without credentials still returns template text', async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const out = await safeExplain({ matches: ids.map(match), careers, locale: 'en', gender: 'male', resultId: 'r2', mode: 'ai' });
      expect(out.every((e) => e.source === 'template')).toBe(true);
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });

  it('builds the result view with a summary and top 5 / more split', async () => {
    const stored = careers.slice(0, 20).map((c, i) => ({ ...match(c.id), rank: i + 1, kind: 'top' as const, fit: 90 - i }));
    const view = await loadResultView(
      { id: 'r3', sessionId: 's', scores: { interests: { R: 0.1, I: 0.9, A: 0.5, S: 0.4, E: 0.2, C: 0.3 }, derived: { hollandCode: 'IAS' } }, matches: stored },
      'en',
      null,
      (i) => safeExplain({ ...i, mode: 'template' }),
    );
    expect(view.top).toHaveLength(5);
    expect(view.more).toHaveLength(15);
    expect(view.summary.length).toBeGreaterThan(10);
    expect(view.hollandCode).toBe('IAS');
  });
});
