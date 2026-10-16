import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Bilingual = { en: string; ar: string };
type Metric = { value: number | null; unit: string; scope: Bilingual; year: number | null; sourceId: string | null };

const read = (rel: string) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const industries = read('../industries/industries.json');
const catalog = read('../careers/catalog.json');

const TRENDS = ['growing', 'stable', 'transforming', 'declining'];
const CONFIDENCE = ['low', 'medium', 'high'];
const MOMENTUM = ['rising', 'steady', 'emerging'];
const EXPOSURE = ['low', 'medium', 'high'];
const clusters: any[] = industries.clusters;

const isBilingual = (v: any): v is Bilingual =>
  !!v && typeof v.en === 'string' && v.en.trim().length > 0 && typeof v.ar === 'string' && v.ar.trim().length > 0;

describe('industries.json', () => {
  it('has top-level metadata', () => {
    expect(typeof industries.version).toBe('string');
    expect(industries.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isBilingual(industries.method)).toBe(true);
  });

  it('covers all 18 catalog cluster ids exactly once', () => {
    const ids = clusters.map((c) => c.id);
    expect(ids).toHaveLength(18);
    expect(new Set(ids).size).toBe(18);
    expect([...ids].sort()).toEqual(catalog.clusters.map((c: { id: string }) => c.id).sort());
  });

  describe.each(clusters.map((c) => [c.id, c] as const))('cluster %s', (_id, c) => {
    it('has bilingual name matching the catalog', () => {
      expect(isBilingual(c.name)).toBe(true);
      const cat = catalog.clusters.find((x: { id: string }) => x.id === c.id);
      expect(c.name).toEqual(cat.name);
    });

    it('economy has the three metrics with year and source, and notes', () => {
      for (const key of ['gdpShare', 'realGrowth', 'employment']) {
        const m: Metric = c.economy[key];
        expect(m, key).toBeTruthy();
        expect(typeof m.unit).toBe('string');
        expect(isBilingual(m.scope), `${key}.scope`).toBe(true);
        if (m.value === null) {
          // never invent numbers: a null value carries no year/source claim
          expect(m.year).toBeNull();
          expect(m.sourceId).toBeNull();
        } else {
          expect(typeof m.value).toBe('number');
          expect(Number.isFinite(m.value)).toBe(true);
          expect(Number.isInteger(m.year)).toBe(true);
          expect(c.sources.map((s: { id: string }) => s.id)).toContain(m.sourceId);
        }
      }
      expect(isBilingual(c.economy.notes)).toBe(true);
    });

    it('has a short, friendly intro: what it is, a day in it, who enjoys it', () => {
      for (const k of ['what', 'day', 'suits']) {
        expect(isBilingual(c.intro?.[k]), k).toBe(true);
        expect(c.intro[k].en.length, `${k} too long`).toBeLessThanOrEqual(140);
        expect(c.intro[k].ar, `${k} ar`).toMatch(/[\u0600-\u06FF]/);
      }
    });

    it('business, policy and technology are bilingual and non-empty', () => {
      for (const k of ['employers', 'startupFreelance', 'remoteGcc']) expect(isBilingual(c.business[k]), k).toBe(true);
      expect(c.policy.length).toBeGreaterThanOrEqual(1);
      for (const p of c.policy) {
        expect(isBilingual(p.name)).toBe(true);
        expect(isBilingual(p.summary)).toBe(true);
      }
      expect(EXPOSURE).toContain(c.technology.exposure);
      expect(isBilingual(c.technology.summary)).toBe(true);
      expect(isBilingual(c.technology.howChanging)).toBe(true);
    });

    it('outlook uses valid enums and a well-formed demand5y', () => {
      const o = c.outlook;
      expect(TRENDS).toContain(o.trend);
      expect(CONFIDENCE).toContain(o.confidence);
      expect(isBilingual(o.rationale)).toBe(true);
      expect(isBilingual(o.demand5y.band)).toBe(true);
      const { low, high } = o.demand5y;
      if (low === null || high === null) {
        expect(low).toBeNull();
        expect(high).toBeNull();
      } else {
        expect(typeof low).toBe('number');
        expect(typeof high).toBe('number');
        expect(low).toBeLessThanOrEqual(high); // a range, never a single promise
        expect(low).not.toBe(high);
      }
    });

    it('has 3-5 suggested changes with momentum', () => {
      expect(c.suggestedChanges.length).toBeGreaterThanOrEqual(3);
      expect(c.suggestedChanges.length).toBeLessThanOrEqual(5);
      for (const s of c.suggestedChanges) {
        expect(isBilingual(s.name)).toBe(true);
        expect(MOMENTUM).toContain(s.momentum);
      }
    });

    it('has at least 2 sources with https URLs and full metadata', () => {
      expect(c.sources.length).toBeGreaterThanOrEqual(2);
      for (const s of c.sources) {
        expect(s.title.trim().length).toBeGreaterThan(0);
        expect(s.publisher.trim().length).toBeGreaterThan(0);
        expect(Number.isInteger(s.year)).toBe(true);
        expect(s.url.startsWith('https://')).toBe(true);
        expect(() => new URL(s.url)).not.toThrow();
        expect(s.accessed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(s.accessed <= industries.asOf).toBe(true);
      }
    });
  });
});
