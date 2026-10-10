import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const catalog = read('careers/catalog.json') as { careers: { id: string }[]; clusters: { id: string }[] };
const careerIds = new Set(catalog.careers.map((c) => c.id));
const clusterIds = new Set(catalog.clusters.map((c) => c.id));
const programIds = new Set((read('opportunities/programs.json').programs as { id: string }[]).map((p) => p.id));
const providerIds = new Set((read('opportunities/providers.json').providers as { id: string }[]).map((p) => p.id));

const dir = join(root, 'careers/pages');
const pages = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ file: f, page: JSON.parse(readFileSync(join(dir, f), 'utf8')) }));

const ARABIC = /[؀-ۿ]/;

/** Every {en, ar} object anywhere in the page must have non-empty English and Arabic (with Arabic script). */
function checkTexts(node: unknown, path: string, errors: string[]) {
  if (Array.isArray(node)) return node.forEach((n, i) => checkTexts(n, `${path}[${i}]`, errors));
  if (!node || typeof node !== 'object') return;
  const o = node as Record<string, unknown>;
  if ('en' in o && 'ar' in o) {
    if (typeof o.en !== 'string' || !o.en.trim()) errors.push(`${path}.en empty`);
    if (typeof o.ar !== 'string' || !ARABIC.test(o.ar)) errors.push(`${path}.ar missing Arabic`);
    return;
  }
  for (const [k, v] of Object.entries(o)) checkTexts(v, `${path}.${k}`, errors);
}

describe('career pages', () => {
  it('has at least the 40 full pages for launch, and lite pages for the rest', () => {
    expect(pages.filter((p) => p.page.depth === 'full').length).toBeGreaterThanOrEqual(40);
    for (const { file, page } of pages) {
      expect(page.id, file).toBe(file.replace('.json', ''));
      expect(careerIds.has(page.id), file).toBe(true);
      expect(['full', 'lite']).toContain(page.depth);
    }
  });

  it.each(pages.map((p) => [p.file, p.page]))('%s is complete and consistent', (_file, page) => {
    const required = ['snapshot', 'whatYouDo', 'pathEgypt', 'progression', 'sources'];
    if (page.depth === 'full') required.push('skills', 'marketEgypt', 'global', 'reality');
    for (const key of required) expect(page[key], key).toBeDefined();

    const errors: string[] = [];
    checkTexts(page, page.id, errors);
    expect(errors).toEqual([]);

    expect(clusterIds.has(page.industryId)).toBe(true);
    for (const id of page.pathEgypt.programIds) expect(programIds.has(id), id).toBe(true);
    for (const id of page.progression.relatedCareerIds) expect(careerIds.has(id), id).toBe(true);
    for (const t of page.pathEgypt.thanaweyaTracks) expect(['science', 'math', 'literary']).toContain(t);
    if (page.depth === 'full') {
      for (const id of page.marketEgypt.providerIds ?? []) expect(providerIds.has(id), id).toBe(true);
      expect(['high', 'medium', 'low']).toContain(page.marketEgypt.demand);
    }

    const salary = page.marketEgypt?.salaryMonthlyEgp;
    if (salary) {
      expect(salary.sourceUrl).toMatch(/^https:\/\//);
      const bands = ['junior', 'mid', 'senior'].map((k) => salary[k]).filter(Boolean);
      expect(bands.length).toBeGreaterThan(0);
      for (const b of bands) {
        expect(b.min).toBeGreaterThan(0);
        expect(b.max).toBeGreaterThanOrEqual(b.min);
      }
    }

    expect(page.sources.length).toBeGreaterThanOrEqual(2);
    for (const s of page.sources) expect(s.url).toMatch(/^https:\/\//);
  });
});
