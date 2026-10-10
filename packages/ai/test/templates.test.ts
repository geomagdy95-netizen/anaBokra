import { describe, expect, it } from 'vitest';
import { careers as catalog } from '@anabokra/content';
import { ABILITY_DOMAINS, BIG_FIVE, RIASEC, WORK_VALUES } from '@anabokra/engine';
import type { CareerMatch, ContextFlag, Reason, WatchOut } from '@anabokra/engine';
import { checkText, explainMatches, flagLine, reasonLine, templateExplanation, watchOutLine } from '../src';
import { careers, fullMatch } from './fixtures';

const reasons: Reason[] = [
  ...RIASEC.map((t) => ({ kind: 'interest' as const, types: [t], strength: 0.8 })),
  { kind: 'interest', types: ['R', 'I', 'A'], strength: 0.8 },
  ...BIG_FIVE.map((trait) => ({ kind: 'personality' as const, trait, strength: 0.8 })),
  ...WORK_VALUES.map((value) => ({ kind: 'value' as const, value, strength: 0.8 })),
  ...ABILITY_DOMAINS.map((domain) => ({ kind: 'ability' as const, domain, strength: 0.8 })),
];
const watchOuts: WatchOut[] = [
  ...BIG_FIVE.map((trait) => ({ kind: 'personalityStretch' as const, trait })),
  ...ABILITY_DOMAINS.map((domain) => ({ kind: 'abilityGap' as const, domain, gap: 0.3 })),
];
const flags: ContextFlag[] = ['trackMismatch', 'scoreReach', 'costHigh'];

describe('template explanations', () => {
  for (const locale of ['en', 'ar'] as const) {
    it(`covers every reason, watch-out and flag kind in ${locale}`, () => {
      const lines = [
        ...reasons.map((r) => reasonLine(r, locale === 'ar' ? 'محاسب' : 'Accountant', locale, 'neutral')),
        ...watchOuts.map((w) => watchOutLine(w, locale === 'ar' ? 'محاسب' : 'Accountant', locale, 'neutral')),
        ...flags.map((f) => flagLine(f, locale === 'ar' ? 'محاسب' : 'Accountant', locale)),
      ];
      for (const line of lines) {
        expect(line.length).toBeGreaterThan(20);
        expect(line).not.toMatch(/undefined|\[object|\{|\}/);
        expect(/[؀-ۿ]/.test(line)).toBe(locale === 'ar' || /محاسب/.test(line));
      }
      expect(new Set(lines).size).toBe(lines.length);
    });
  }

  it('uses feminine Arabic forms for female users and masculine otherwise', () => {
    const interest: Reason = { kind: 'interest', types: ['S'], strength: 0.9 };
    expect(reasonLine(interest, 'محاسب', 'ar', 'female')).toContain('مهتمة');
    expect(reasonLine(interest, 'محاسب', 'ar', 'male')).toContain('مهتم ');
    expect(reasonLine(interest, 'محاسب', 'ar', 'neutral')).toBe(reasonLine(interest, 'محاسب', 'ar', 'male'));
    const stretch: WatchOut = { kind: 'personalityStretch', trait: 'extraversion' };
    expect(watchOutLine(stretch, 'محاسب', 'ar', 'female')).toContain('قادرة');
    expect(watchOutLine(stretch, 'محاسب', 'ar', 'male')).toContain('قادر ');
  });

  it('builds a 2-3 sentence text with the career name, and keeps all structured lines', () => {
    const en = templateExplanation(fullMatch, careers[0], 'en', 'male');
    expect(en.source).toBe('template');
    expect(en.text).toContain('Accountant');
    expect(en.text).toContain('strongest matches');
    expect(en.reasons).toHaveLength(4);
    expect(en.watchOuts).toHaveLength(2);
    expect(en.flags).toHaveLength(3);
    const ar = templateExplanation(fullMatch, careers[0], 'ar', 'female');
    expect(ar.text).toContain('محاسب');
    expect(ar.text).toContain('مهتمة');
  });

  it('falls back to the career id when the career is unknown, and handles empty reasons', () => {
    const bare: CareerMatch = { ...fullMatch, careerId: 'mystery', reasons: [], watchOuts: [], flags: [], fit: 40 };
    const e = templateExplanation(bare, undefined, 'en', 'neutral');
    expect(e.text).toContain('mystery');
    expect(e.text).toContain('worth exploring');
  });

  it('never changes the match scores', () => {
    const before = JSON.stringify(fullMatch);
    templateExplanation(fullMatch, careers[0], 'en', 'male');
    expect(JSON.stringify(fullMatch)).toBe(before);
  });

  it('template mode returns one explanation per match, in order, without needing a client', async () => {
    const out = await explainMatches({
      matches: [fullMatch, { ...fullMatch, careerId: 'architect' }],
      careers,
      locale: 'en',
      gender: 'male',
      mode: 'template',
      resultId: 'r1',
    });
    expect(out.map((o) => o.careerId)).toEqual(['accountant', 'architect']);
    expect(out.every((o) => o.source === 'template')).toBe(true);
  });

  it('every template text for every catalog career passes the guardrails in both languages', () => {
    for (const c of catalog) {
      for (const locale of ['en', 'ar'] as const) {
        for (const gender of ['male', 'female'] as const) {
          const m: CareerMatch = { ...fullMatch, careerId: c.id };
          const names = [c.name.en, c.name.ar];
          const e = templateExplanation(m, c, locale, gender);
          const r = checkText(e.text, locale, names);
          expect(r, `${c.id} ${locale} ${gender}: ${e.text}`).toEqual({ ok: true });
          const noCaution = templateExplanation({ ...m, watchOuts: [], flags: [] }, c, locale, gender);
          expect(checkText(noCaution.text, locale, names), noCaution.text).toEqual({ ok: true });
          for (const line of [...e.reasons, ...e.watchOuts, ...e.flags]) {
            expect(line).not.toMatch(/undefined/);
          }
        }
      }
    }
  });
});
