import { describe, expect, it } from 'vitest';

import { getExploreCatalog, getProgramRows } from './catalog';
import { EMPTY_PROGRAM_FILTERS, filterPrograms, filterProviders, filterUniversities, MAX_COMPARE_PROGRAMS, parseCompareIds, toggleCompare } from './filters';
import { governorateId, placeId } from './governorates';

const rows = getProgramRows();
const none = { expectedScorePct: null, track: null };
const f = (p: Partial<typeof EMPTY_PROGRAM_FILTERS>) => ({ ...EMPTY_PROGRAM_FILTERS, ...p });

describe('catalog', () => {
  it('maps content governorate names to ids', () => {
    expect(governorateId('Beni Suef')).toBe('beni_suef');
    expect(governorateId('Menoufia')).toBe('monufia');
    expect(governorateId('Kafr El Sheikh')).toBe('kafr_el_sheikh');
    expect(governorateId('Atlantis')).toBeNull();
    expect(placeId('nationwide')).toBe('nationwide');
    expect(getExploreCatalog().universities.every((u) => u.governorate)).toBe(true);
  });
});

describe('filterPrograms', () => {
  it('filters by type, governorate, track and language', () => {
    expect(filterPrograms(rows, f({ type: 'private' }), none).every((h) => h.row.universityType === 'private')).toBe(true);
    expect(filterPrograms(rows, f({ governorate: 'cairo' }), none).every((h) => h.row.governorate === 'cairo')).toBe(true);
    expect(filterPrograms(rows, f({ track: 'literary' }), none).every((h) => h.row.tracks.includes('literary'))).toBe(true);
    expect(filterPrograms(rows, f({ language: 'en' }), none).every((h) => h.row.language === 'en')).toBe(true);
    expect(filterPrograms(rows, f({ type: 'public', governorate: 'cairo' }), none).length).toBeGreaterThan(0);
  });
  it('a fee range keeps only programs that have a fee', () => {
    const hits = filterPrograms(rows, f({ feeMin: 0 }), none);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThan(rows.length);
    expect(hits.every((h) => h.row.fee !== null)).toBe(true);
    const capped = filterPrograms(rows, f({ feeMin: 100000, feeMax: 200000 }), none);
    expect(capped.every((h) => h.row.fee!.value >= 100000 && h.row.fee!.value <= 200000)).toBe(true);
  });
  it('feasibility filter uses the user score and track', () => {
    const user = { expectedScorePct: 99, track: 'science' };
    const likely = filterPrograms(rows, f({ feasibility: 'likely' }), user);
    expect(likely.length).toBeGreaterThan(0);
    expect(likely.every((h) => h.feasibility.status === 'likely')).toBe(true);
    expect(filterPrograms(rows, f({ feasibility: 'likely' }), none)).toHaveLength(0);
  });
  it('programs with only a regulatory minimum never match likely/reach/unlikely', () => {
    const onlyMin = rows.filter((r) => r.cutoffs.length === 0 && r.minimum);
    expect(onlyMin.length).toBeGreaterThan(0);
    const hits = filterPrograms(onlyMin, f({}), { expectedScorePct: 99, track: 'science' });
    expect(hits.every((h) => h.feasibility.status === 'unknown')).toBe(true);
  });
  it('searches Arabic with folded letters and diacritics', () => {
    const a = filterPrograms(rows, f({ q: 'كلية طب' }), none).length;
    expect(a).toBeGreaterThan(0);
    expect(filterPrograms(rows, f({ q: 'جامعه القاهره' }), none).some((h) => h.row.universityId === 'cairo-university')).toBe(true);
    expect(filterPrograms(rows, f({ q: 'جَامِعَة القاهرة' }), none).some((h) => h.row.universityId === 'cairo-university')).toBe(true);
    expect(filterPrograms(rows, f({ q: 'cairo medicine' }), none).some((h) => h.row.id === 'cairo-university-medicine')).toBe(true);
  });
});

describe('universities and providers', () => {
  const c = getExploreCatalog();
  it('filters universities', () => {
    const r = filterUniversities(c.universities, { q: 'القاهرة', type: 'public', governorate: '' });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((u) => u.type === 'public')).toBe(true);
  });
  it('a governorate filter on providers also keeps nationwide and online ones', () => {
    const r = filterProviders(c.providers, { q: '', governorate: 'giza' });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((p) => p.governorates.some((g) => ['nationwide', 'online'].includes(g.toLowerCase()) || governorateId(g) === 'giza'))).toBe(true);
  });
});

describe('compare', () => {
  it('refuses a fourth program', () => {
    let ids: string[] = [];
    for (const id of ['a', 'b', 'c']) ids = toggleCompare(ids, id).ids;
    expect(ids).toHaveLength(MAX_COMPARE_PROGRAMS);
    const r = toggleCompare(ids, 'd');
    expect(r).toEqual({ ids: ['a', 'b', 'c'], full: true });
    expect(toggleCompare(ids, 'b')).toEqual({ ids: ['a', 'c'], full: false });
  });
  it('parses ids: dedupes, trims and caps at 3', () => {
    expect(parseCompareIds(' a, b ,a,c,d,')).toEqual(['a', 'b', 'c']);
    expect(parseCompareIds(undefined)).toEqual([]);
  });
});
