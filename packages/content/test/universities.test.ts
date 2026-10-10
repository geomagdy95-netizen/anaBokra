import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (name: string) =>
  JSON.parse(readFileSync(new URL(`../opportunities/${name}`, import.meta.url), 'utf8'));

const dataset = read('universities.json');
const schema = read('universities.schema.json');
const universitySchema = schema.$defs.university;
const list: Array<Record<string, any>> = dataset.universities;

const GOVERNORATES: string[] = [
  'Alexandria', 'Assiut', 'Aswan', 'Beheira', 'Beni Suef', 'Cairo', 'Dakahlia', 'Damietta', 'Fayoum',
  'Gharbia', 'Giza', 'Ismailia', 'Kafr El Sheikh', 'Luxor', 'Matrouh', 'Menoufia', 'Minya', 'New Valley',
  'North Sinai', 'Port Said', 'Qalyubia', 'Qena', 'Red Sea', 'Sharqia', 'Sohag', 'South Sinai', 'Suez',
];
const TYPES = ['public', 'private', 'national', 'technological', 'international_branch', 'azhar', 'other'];

describe('universities dataset', () => {
  it('has the top-level fields', () => {
    for (const k of schema.required) expect(dataset, k).toHaveProperty(k);
    expect(dataset.sources.length).toBeGreaterThan(0);
    for (const s of dataset.sources) expect(s.url).toMatch(/^https:\/\//);
  });

  it('every record has all schema-required fields', () => {
    for (const u of list) for (const k of universitySchema.required) expect(u, `${u.id}.${k}`).toHaveProperty(k);
  });

  it('has no unknown fields and well-formed names', () => {
    const allowed = Object.keys(universitySchema.properties);
    for (const u of list) {
      expect(Object.keys(u).filter((k) => !allowed.includes(k)), u.id).toEqual([]);
      expect(u.name.en.length, u.id).toBeGreaterThan(0);
      expect(u.name.ar, u.id).toMatch(/[؀-ۿ]/);
    }
  });

  it('has unique kebab-case ids', () => {
    const ids = list.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('uses valid type values (schema enum matches)', () => {
    expect(universitySchema.properties.type.enum).toEqual(TYPES);
    for (const u of list) expect(TYPES, u.id).toContain(u.type);
  });

  it('uses one of the 27 governorates', () => {
    expect(GOVERNORATES).toHaveLength(27);
    expect(universitySchema.properties.governorate.enum).toEqual(GOVERNORATES);
    for (const u of list) expect(GOVERNORATES, u.id).toContain(u.governorate);
  });

  it('uses https URLs (website nullable, sourceUrl required)', () => {
    for (const u of list) {
      if (u.website !== null) expect(u.website, u.id).toMatch(/^https:\/\//);
      expect(u.sourceUrl, u.id).toMatch(/^https:\/\//);
    }
  });

  it('has sane established years, verifiedAt and city', () => {
    for (const u of list) {
      if (u.established !== null) {
        expect(Number.isInteger(u.established), u.id).toBe(true);
        expect(u.established, u.id).toBeGreaterThanOrEqual(900);
        expect(u.established, u.id).toBeLessThanOrEqual(2026);
      }
      expect(u.verifiedAt, u.id).toBe('2026-10-09');
      expect(u.city.length, u.id).toBeGreaterThan(0);
    }
  });

  it('has at least 100 universities and every type is represented', () => {
    expect(list.length).toBeGreaterThanOrEqual(100);
    for (const t of TYPES) expect(list.some((u) => u.type === t), t).toBe(true);
  });
});
