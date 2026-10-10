import { describe, expect, it, vi } from 'vitest';
import { InMemoryExplanationCache, PROMPT_VERSION, cacheKey, checkText, explainMatches } from '../src';
import type { UsageRecord } from '../src';
import { GOOD_AR, GOOD_EN, aiJson, careers, fullMatch, mockClient, plainMatch } from './fixtures';

const base = {
  matches: [fullMatch, plainMatch('architect')],
  careers,
  locale: 'en' as const,
  gender: 'male' as const,
  mode: 'ai' as const,
  resultId: 'res-1',
};

const firstCall = (create: { mock: { calls: unknown[][] } }) => create.mock.calls[0]![0] as any;

describe('AI mode', () => {
  it('happy path: uses model text, keeps structured lines, caches, logs usage, sends cached system prompt', async () => {
    const { client, create } = mockClient([aiJson({ accountant: GOOD_EN, architect: GOOD_EN })]);
    const usage: UsageRecord[] = [];
    const cache = new InMemoryExplanationCache();
    const out = await explainMatches({
      ...base,
      deps: { client, cache, onUsage: (u) => void usage.push(u), engineVersion: 'e1' },
    });

    expect(create).toHaveBeenCalledTimes(1);
    const params = firstCall(create);
    expect(params.model).toBe('claude-sonnet-5-5');
    expect(params.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(params.output_config.format.type).toBe('json_schema');
    const payload = JSON.parse(params.messages[0].content);
    expect(payload.careers.map((c: any) => c.careerId)).toEqual(['accountant', 'architect']);
    expect(payload.careers[0].snapshot.hook).toContain('money');
    expect(payload.careers[0].reasons[0]).toHaveProperty('fact');

    expect(out[0]).toMatchObject({ careerId: 'accountant', text: GOOD_EN, source: 'ai' });
    expect(out[0]!.reasons).toHaveLength(4); // deterministic lines are still returned
    expect(out[1]!.source).toBe('ai');
    expect(cache.size).toBe(2);
    expect(usage).toEqual([
      expect.objectContaining({ model: 'claude-sonnet-5-5', inputTokens: 900, outputTokens: 120, resultId: 'res-1' }),
    ]);
  });

  it('only the top 5 matches are sent to the model; the rest stay on templates', async () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => plainMatch(id));
    const { client, create } = mockClient([aiJson(Object.fromEntries(many.map((m) => [m.careerId, GOOD_EN])))]);
    const out = await explainMatches({ ...base, matches: many, deps: { client, cache: new InMemoryExplanationCache() } });
    expect(JSON.parse(firstCall(create).messages[0].content).careers).toHaveLength(5);
    expect(out.map((o) => o.source)).toEqual(['ai', 'ai', 'ai', 'ai', 'ai', 'template']);
  });

  it('uses ANABOKRA_AI_MODEL when set', async () => {
    vi.stubEnv('ANABOKRA_AI_MODEL', 'my-model');
    const { client, create } = mockClient([aiJson({ accountant: GOOD_EN })]);
    await explainMatches({ ...base, matches: [fullMatch], deps: { client, cache: new InMemoryExplanationCache() } });
    expect(firstCall(create).model).toBe('my-model');
    vi.unstubAllEnvs();
  });

  it('works in Arabic', async () => {
    const { client } = mockClient([aiJson({ accountant: GOOD_AR })]);
    const out = await explainMatches({
      ...base,
      matches: [fullMatch],
      locale: 'ar',
      gender: 'female',
      deps: { client, cache: new InMemoryExplanationCache() },
    });
    expect(out[0]).toMatchObject({ text: GOOD_AR, source: 'ai' });
  });

  it('malformed JSON falls back to templates', async () => {
    const { client } = mockClient(['this is not json {']);
    const cache = new InMemoryExplanationCache();
    const out = await explainMatches({ ...base, deps: { client, cache } });
    expect(out.every((o) => o.source === 'template')).toBe(true);
    expect(out[0]!.text).toContain('Accountant');
    expect(cache.size).toBe(0);
  });

  it('JSON that fails the zod schema falls back to templates', async () => {
    const { client } = mockClient([JSON.stringify({ explanations: [{ careerId: 'accountant' }] })]);
    const out = await explainMatches({ ...base, deps: { client, cache: new InMemoryExplanationCache() } });
    expect(out.every((o) => o.source === 'template')).toBe(true);
  });

  it('API errors fall back to templates', async () => {
    const client = { messages: { create: vi.fn().mockRejectedValue(new Error('boom')) } } as any;
    const out = await explainMatches({ ...base, deps: { client, cache: new InMemoryExplanationCache() } });
    expect(out.every((o) => o.source === 'template')).toBe(true);
  });

  it('a banned term rejects only that career, which falls back to its template', async () => {
    const bad = 'You may have a disorder that makes this hard. Please see a specialist soon. It could be a real challenge.';
    const { client } = mockClient([aiJson({ accountant: bad, architect: GOOD_EN })]);
    const cache = new InMemoryExplanationCache();
    const out = await explainMatches({ ...base, deps: { client, cache } });
    expect(out[0]!.source).toBe('template');
    expect(out[0]!.text).not.toContain('disorder');
    expect(out[1]!.source).toBe('ai');
    expect(cache.size).toBe(1);
  });

  it('Arabic banned term (اضطراب) falls back', async () => {
    const bad = 'قد يكون لديك اضطراب في التركيز يجعل هذه المهنة صعبة. لذلك ننصحك بالحذر الشديد. وربما تحتاج إلى مساعدة.';
    const { client } = mockClient([aiJson({ accountant: bad })]);
    const out = await explainMatches({
      ...base,
      matches: [fullMatch],
      locale: 'ar',
      deps: { client, cache: new InMemoryExplanationCache() },
    });
    expect(out[0]!.source).toBe('template');
  });

  it('cache hit avoids a second model call', async () => {
    const { client, create } = mockClient([aiJson({ accountant: GOOD_EN, architect: GOOD_EN })]);
    const cache = new InMemoryExplanationCache();
    const deps = { client, cache, engineVersion: 'e1' };
    const first = await explainMatches({ ...base, deps });
    const second = await explainMatches({ ...base, deps });
    expect(create).toHaveBeenCalledTimes(1);
    expect(first.map((o) => o.source)).toEqual(['ai', 'ai']);
    expect(second.map((o) => o.source)).toEqual(['cache', 'cache']);
    expect(second[0]!.text).toBe(GOOD_EN);

    // A different engine version is a different key, so it calls again.
    await explainMatches({ ...base, deps: { ...deps, engineVersion: 'e2' } });
    expect(create).toHaveBeenCalledTimes(2);
  });
});

describe('cacheKey', () => {
  it('is stable and sensitive to every part', () => {
    const p = { resultId: 'r', careerId: 'c', locale: 'en', gender: 'male', engineVersion: 'e', promptVersion: PROMPT_VERSION } as const;
    expect(cacheKey(p)).toBe(cacheKey({ ...p }));
    expect(cacheKey(p)).toMatch(/^[0-9a-f]{64}$/);
    for (const change of [
      { resultId: 'r2' },
      { careerId: 'c2' },
      { locale: 'ar' },
      { gender: 'female' },
      { engineVersion: 'e2' },
      { promptVersion: 'x' },
    ]) {
      expect(cacheKey({ ...p, ...change } as any)).not.toBe(cacheKey(p));
    }
  });
});

describe('guardrails', () => {
  it('rejects banned terms, numbers, wrong language and bad lengths; accepts good text', () => {
    expect(checkText(GOOD_EN, 'en')).toEqual({ ok: true });
    expect(checkText(GOOD_AR, 'ar')).toEqual({ ok: true });
    const bad = (t: string, l: 'en' | 'ar') => checkText(t, l).ok;
    const pad = ' This sentence is only here so the length and sentence count checks pass. And so is this one.';
    expect(bad('You will fail at this career for sure.' + pad, 'en')).toBe(false);
    expect(bad('Your IQ is a good fit for this career.' + pad, 'en')).toBe(false);
    expect(bad('We can help with a diagnosis of your strengths.' + pad, 'en')).toBe(false);
    expect(bad('The salary here is great.' + pad, 'en')).toBe(false);
    expect(bad('You are guaranteed a place at university.' + pad, 'en')).toBe(false);
    expect(bad('You are weak at numbers, sadly.' + pad, 'en')).toBe(false);
    expect(bad('You will love 5 things about it.' + pad, 'en')).toBe(false);
    expect(bad('ستفشل في هذه المهنة بالتأكيد. هذا الكلام لا يجب أن يظهر أبدًا. لأنه سيئ.', 'ar')).toBe(false);
    expect(bad('تشخيص قدراتك يقول إنك مناسب لها جدًا. وهذه مهنة جميلة تحتاج لصبر. وستستمتع بها.', 'ar')).toBe(false);
    expect(bad('هذا نص عربي ولكن اللغة المطلوبة إنجليزية. ولا يجب أن يقبل. ولا بد من رفضه.', 'en')).toBe(false);
    expect(checkText('Short.', 'en')).toEqual({ ok: false, reason: 'too_short' });
    expect(checkText('A sentence goes on. '.repeat(40), 'en')).toEqual({ ok: false, reason: 'too_long' });
    expect(checkText('One long sentence without any stop that is long enough to pass the length check', 'en')).toEqual({
      ok: false,
      reason: 'sentence_count',
    });
  });

  it('does not flag Arabic words that merely contain a banned substring (مستقبل, مرتبط)', () => {
    const t = 'هذه المهنة مرتبطة بما تحب وتفتح لك باب المستقبل. وأنت تملك الفضول الذي تحتاجه. فابدأ بخطوة صغيرة.';
    expect(checkText(t, 'ar')).toEqual({ ok: true });
  });
});
