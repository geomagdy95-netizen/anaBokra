import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));

const dataset = read('opportunities/providers.json');
const schema = read('opportunities/providers.schema.json');
const catalog = read('careers/catalog.json');
const providerSchema = schema.$defs.provider;
const list: Array<Record<string, any>> = dataset.providers;
const careerIds = new Set<string>(catalog.careers.map((c: { id: string }) => c.id));

const KINDS = [
  'bootcamp', 'platform', 'government_program', 'ngo_program', 'technical_school',
  'language_school', 'creative_academy', 'corporate_academy', 'other',
];
const FORMATS = ['online', 'offline', 'hybrid'];
const COST_TYPES = ['free', 'paid', 'scholarship', 'mixed'];
const ELIGIBILITY = ['under18_ok', 'adults_only', 'graduates', 'all_ages', 'unspecified'];
const GOVERNORATES: string[] = [
  'Alexandria', 'Assiut', 'Aswan', 'Beheira', 'Beni Suef', 'Cairo', 'Dakahlia', 'Damietta', 'Fayoum',
  'Gharbia', 'Giza', 'Ismailia', 'Kafr El Sheikh', 'Luxor', 'Matrouh', 'Menoufia', 'Minya', 'New Valley',
  'North Sinai', 'Port Said', 'Qalyubia', 'Qena', 'Red Sea', 'Sharqia', 'Sohag', 'South Sinai', 'Suez',
];
const SPECIAL = ['online', 'nationwide'];
const isNullOrInt = (v: unknown) => v === null || Number.isInteger(v);

describe('providers dataset', () => {
  it('has the top-level fields and at least 40 providers', () => {
    for (const k of schema.required) expect(dataset, k).toHaveProperty(k);
    expect(dataset.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(dataset.asOf).toBe('2026-10-09');
    expect(list.length).toBeGreaterThanOrEqual(40);
  });

  it('every record has all schema-required fields and no unknown fields', () => {
    const allowed = Object.keys(providerSchema.properties);
    expect(new Set(providerSchema.required)).toEqual(new Set(allowed));
    for (const p of list) {
      for (const k of providerSchema.required) expect(p, `${p.id}.${k}`).toHaveProperty(k);
      expect(Object.keys(p).filter((k) => !allowed.includes(k)), p.id).toEqual([]);
    }
  });

  it('has unique kebab-case ids and bilingual names', () => {
    const ids = list.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of list) {
      expect(p.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(p.name.en.length, p.id).toBeGreaterThan(0);
      expect(p.name.ar, p.id).toMatch(/[؀-ۿ]/);
    }
  });

  it('uses valid enums (schema enums match the test lists)', () => {
    expect(providerSchema.properties.kind.enum).toEqual(KINDS);
    expect(providerSchema.properties.format.enum).toEqual(FORMATS);
    expect(providerSchema.properties.eligibility.enum).toEqual(ELIGIBILITY);
    for (const p of list) {
      expect(KINDS, p.id).toContain(p.kind);
      expect(FORMATS, p.id).toContain(p.format);
      expect(ELIGIBILITY, p.id).toContain(p.eligibility);
    }
  });

  it('has well-formed governorates', () => {
    expect(GOVERNORATES).toHaveLength(27);
    expect(providerSchema.properties.governorates.items.enum).toEqual([...GOVERNORATES, ...SPECIAL]);
    for (const p of list) {
      expect(Array.isArray(p.governorates), p.id).toBe(true);
      expect(p.governorates.length, p.id).toBeGreaterThan(0);
      expect(new Set(p.governorates).size, p.id).toBe(p.governorates.length);
      for (const g of p.governorates) expect([...GOVERNORATES, ...SPECIAL], `${p.id}:${g}`).toContain(g);
      const special = p.governorates.filter((g: string) => SPECIAL.includes(g));
      if (special.length > 0) expect(p.governorates, `${p.id} special values stand alone`).toHaveLength(1);
      if (p.format === 'online') expect(p.governorates, p.id).toEqual(['online']);
    }
  });

  it('has well-formed cost objects (never invented: null when unknown)', () => {
    for (const p of list) {
      if (p.cost === null) continue;
      expect(Object.keys(p.cost).sort(), p.id).toEqual(['type', 'typicalEgp', 'year']);
      expect(COST_TYPES, p.id).toContain(p.cost.type);
      if (p.cost.typicalEgp !== null) {
        expect(typeof p.cost.typicalEgp, p.id).toBe('number');
        expect(p.cost.typicalEgp, p.id).toBeGreaterThan(0);
        expect(Number.isInteger(p.cost.year), `${p.id} needs a year when a price is given`).toBe(true);
        expect(['paid', 'mixed']).toContain(p.cost.type);
      }
      if (p.cost.year !== null) {
        expect(p.cost.year, p.id).toBeGreaterThanOrEqual(2015);
        expect(p.cost.year, p.id).toBeLessThanOrEqual(2026);
      }
    }
  });

  it('has sane ages and eligibility consistent with them', () => {
    for (const p of list) {
      expect(isNullOrInt(p.ageMin), p.id).toBe(true);
      expect(isNullOrInt(p.ageMax), p.id).toBe(true);
      if (p.ageMin !== null && p.ageMax !== null) expect(p.ageMin, p.id).toBeLessThanOrEqual(p.ageMax);
      if (p.eligibility === 'adults_only') expect(p.ageMin, p.id).toBeGreaterThanOrEqual(18);
      if (p.eligibility === 'under18_ok' && p.ageMin !== null) expect(p.ageMin, p.id).toBeLessThan(18);
      if (p.ageMax !== null) expect(p.ageMax, p.id).toBeGreaterThanOrEqual(13);
      expect(p.audience.en.length, p.id).toBeGreaterThan(0);
      expect(p.audience.ar, p.id).toMatch(/[؀-ۿ]/);
    }
  });

  it('has skills tags and career ids that exist in the catalog', () => {
    expect(careerIds.size).toBeGreaterThan(50);
    for (const p of list) {
      expect(p.skills.length, p.id).toBeGreaterThan(0);
      for (const s of p.skills) expect(typeof s === 'string' && s.length > 0, p.id).toBe(true);
      expect(p.careerIds.length, p.id).toBeGreaterThan(0);
      expect(new Set(p.careerIds).size, p.id).toBe(p.careerIds.length);
      for (const c of p.careerIds) expect(careerIds.has(c), `${p.id} -> unknown career ${c}`).toBe(true);
    }
  });

  it('uses https URLs (website nullable, sourceUrl required)', () => {
    for (const p of list) {
      if (p.website !== null) expect(p.website, p.id).toMatch(/^https:\/\//);
      expect(p.sourceUrl, p.id).toMatch(/^https:\/\//);
    }
  });

  it('has verifiedAt and well-formed notes', () => {
    for (const p of list) {
      expect(p.verifiedAt, p.id).toBe('2026-10-09');
      if (p.notes !== null) {
        expect(p.notes.en.length, p.id).toBeGreaterThan(0);
        expect(p.notes.ar, p.id).toMatch(/[؀-ۿ]/);
      }
    }
  });

  it('covers the main provider kinds', () => {
    for (const k of KINDS) expect(list.some((p) => p.kind === k), k).toBe(true);
  });
});
