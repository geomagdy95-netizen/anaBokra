import { careers, clusters, industryById } from '@anabokra/content';
import { describe, expect, it } from 'vitest';

import { getCareerPage } from '@/server/content/career-pages';

import { buildCatalog, type CatalogItem } from './catalog';
import { DEFAULT_FILTERS, filterCatalog, parseCompareIds, sortCatalog, toggleCompare } from './filters';
import { MAX_COMPARE } from './types';

const catalog: CatalogItem[] = buildCatalog(careers, clusters, getCareerPage, (id) => industryById(id)?.outlook.trend ?? null);
const none = {};
const ids = (items: CatalogItem[]) => items.map((i) => i.id);

describe('catalog', () => {
  it('has every career, with a page flag', () => {
    expect(catalog).toHaveLength(careers.length);
    expect(catalog.find((c) => c.id === 'software_engineer')?.depth).toBe('full');
    expect(catalog.every((c) => ['full', 'lite', 'none'].includes(c.depth))).toBe(true);
  });
});

describe('filterCatalog', () => {
  it('searches English and Arabic names, ignoring diacritics', () => {
    expect(ids(filterCatalog(catalog, { ...DEFAULT_FILTERS, query: 'software' }, none))).toContain('software_engineer');
    const arName = catalog.find((c) => c.id === 'software_engineer')!.name.ar;
    expect(ids(filterCatalog(catalog, { ...DEFAULT_FILTERS, query: arName }, none))).toContain('software_engineer');
    // The same Arabic word with tashkeel added still finds it.
    const withMarks = arName.split(' ').map((w) => `${w.slice(0, 1)}َ${w.slice(1)}`).join(' ');
    expect(ids(filterCatalog(catalog, { ...DEFAULT_FILTERS, query: withMarks }, none))).toContain('software_engineer');
    // Searching by field name works too.
    expect(filterCatalog(catalog, { ...DEFAULT_FILTERS, query: 'الصحة' }, none).every((c) => c.cluster === 'health' || /الصحة/.test(c.name.ar))).toBe(true);
  });

  it('filters by cluster', () => {
    const r = filterCatalog(catalog, { ...DEFAULT_FILTERS, cluster: 'health' }, none);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((c) => c.cluster === 'health')).toBe(true);
  });

  it('filters by Thanaweya track and excludes careers with no track data', () => {
    const r = filterCatalog(catalog, { ...DEFAULT_FILTERS, track: 'literary' }, none);
    expect(r.every((c) => c.tracks?.includes('literary'))).toBe(true);
    expect(ids(r)).not.toContain('software_engineer');
  });

  it('filters by outlook trend and by having salary data', () => {
    const growing = filterCatalog(catalog, { ...DEFAULT_FILTERS, trend: 'growing' }, none);
    expect(growing.length).toBeGreaterThan(0);
    expect(growing.every((c) => c.trend === 'growing')).toBe(true);
    const paid = filterCatalog(catalog, { ...DEFAULT_FILTERS, hasSalary: true }, none);
    expect(paid.every((c) => c.hasSalary)).toBe(true);
    expect(paid.length).toBeLessThan(catalog.length);
    expect(ids(paid)).not.toContain('ai_engineer'); // authored with a null salary
  });

  it('filters by minimum fit only among careers that have a fit', () => {
    const fits = { software_engineer: 82, physician: 55 };
    expect(ids(filterCatalog(catalog, { ...DEFAULT_FILTERS, minFit: 70 }, fits))).toEqual(['software_engineer']);
    expect(ids(filterCatalog(catalog, { ...DEFAULT_FILTERS, minFit: 50 }, fits)).sort()).toEqual(['physician', 'software_engineer']);
  });

  it('combines filters', () => {
    const r = filterCatalog(catalog, { ...DEFAULT_FILTERS, cluster: 'tech', hasSalary: true, query: 'engineer' }, none);
    expect(r.every((c) => c.cluster === 'tech' && c.hasSalary)).toBe(true);
  });
});

describe('sortCatalog', () => {
  const fits = { software_engineer: 70, physician: 90, nurse: 90 };
  it('sorts by fit descending with missing fits last', () => {
    const r = sortCatalog(catalog, 'fit', fits, 'en');
    expect(ids(r).slice(0, 3)).toEqual(['nurse', 'physician', 'software_engineer']);
    expect(fits[ids(r)[3] as keyof typeof fits]).toBeUndefined();
  });

  it('sorts by name in the active locale', () => {
    const r = sortCatalog(catalog, 'name', none, 'en').map((c) => c.name.en);
    expect(r).toEqual([...r].sort(new Intl.Collator('en').compare));
  });

  it('puts careers without study years or salary last', () => {
    const study = sortCatalog(catalog, 'study', none, 'en');
    const firstNull = study.findIndex((c) => c.studyYears === null);
    if (firstNull >= 0) expect(study.slice(firstNull).every((c) => c.studyYears === null)).toBe(true);
    const salary = sortCatalog(catalog, 'salary', none, 'en');
    expect(salary[0]!.salaryTop).not.toBeNull();
    expect(salary.at(-1)!.salaryTop).toBeNull();
  });
});

describe('compare selection', () => {
  it('allows up to MAX_COMPARE careers and refuses the next one', () => {
    let sel: string[] = [];
    for (const id of ['a', 'b', 'c']) {
      const r = toggleCompare(sel, id);
      expect(r.added).toBe(true);
      sel = r.ids;
    }
    expect(sel).toHaveLength(MAX_COMPARE);
    const fourth = toggleCompare(sel, 'd');
    expect(fourth.blocked).toBe(true);
    expect(fourth.ids).toEqual(sel);
    // Removing frees a slot.
    expect(toggleCompare(sel, 'b').ids).toEqual(['a', 'c']);
  });

  it('parses ?ids: unknown ids dropped, duplicates removed, capped at 3', () => {
    const known = (id: string) => ['a', 'b', 'c', 'd'].includes(id);
    expect(parseCompareIds('a,b,zzz,a,c,d', known)).toEqual(['a', 'b', 'c']);
    expect(parseCompareIds(['a', '', 'b'], known)).toEqual(['a', 'b']);
    expect(parseCompareIds(undefined, known)).toEqual([]);
  });
});
