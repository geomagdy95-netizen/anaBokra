import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));

const dataset = read('opportunities/programs.json');
const schema = read('opportunities/programs.schema.json');
const universities = read('opportunities/universities.json').universities as Array<Record<string, any>>;
const catalog = read('careers/catalog.json');

const programSchema = schema.$defs.program;
const minScoreSchema = schema.$defs.minScore;
const feesSchema = schema.$defs.fees;
const list: Array<Record<string, any>> = dataset.programs;
const universityIds = new Set(universities.map((u) => u.id));
const careerIds = new Set<string>(catalog.careers.map((c: { id: string }) => c.id));

const TRACKS = ['science', 'math', 'literary'];
const SCORE_TRACKS = [...TRACKS, 'any'];
const LANGS = ['ar', 'en', 'mixed', null];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ARABIC = /[؀-ۿ]/;

const SCOPE = [
  'cairo-university', 'ain-shams-university', 'alexandria-university', 'mansoura-university',
  'assiut-university', 'zagazig-university', 'tanta-university', 'capital-university',
  'menoufia-university', 'benha-university', 'suez-canal-university', 'minia-university',
  'sohag-university', 'kafrelsheikh-university', 'beni-suef-university', 'fayoum-university',
  'qena-university', 'damanhour-university', 'port-said-university', 'damietta-university',
  'american-university-in-cairo', 'german-university-in-cairo', 'british-university-in-egypt',
  'nile-university', 'zewail-city', 'egypt-japan-university-of-science-and-technology',
  'misr-international-university', 'misr-university-for-science-and-technology',
  'future-university-in-egypt', 'ain-shams-national-university',
];

const isHttps = (s: unknown) => typeof s === 'string' && /^https:\/\/[^\s]+$/.test(s);
const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

describe('programs dataset', () => {
  it('has the top-level fields', () => {
    for (const k of schema.required) expect(dataset, k).toHaveProperty(k);
    expect(Object.keys(dataset).filter((k) => !Object.keys(schema.properties).includes(k))).toEqual([]);
    expect(dataset.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(isDate(dataset.asOf)).toBe(true);
    expect(dataset.sources.length).toBeGreaterThan(0);
    for (const s of dataset.sources) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(isHttps(s.url), s.url).toBe(true);
    }
    expect(dataset.scoringSystems.map((s: any) => s.scoreMax).sort()).toEqual([320, 410]);
  });

  it('every record has all schema-required fields and no unknown fields', () => {
    const allowed = Object.keys(programSchema.properties);
    for (const p of list) {
      for (const k of programSchema.required) expect(p, `${p.id}.${k}`).toHaveProperty(k);
      expect(Object.keys(p).filter((k) => !allowed.includes(k)), p.id).toEqual([]);
    }
  });

  it('has unique kebab-case ids', () => {
    const ids = list.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(KEBAB);
  });

  it('is sizeable and covers all 30 in-scope universities', () => {
    expect(list.length).toBeGreaterThanOrEqual(250);
    const covered = new Set(list.map((p) => p.universityId));
    for (const id of SCOPE) expect(covered.has(id), id).toBe(true);
    expect([...covered].filter((id) => !SCOPE.includes(id))).toEqual([]);
  });

  it('references only universities that exist in universities.json', () => {
    for (const p of list) expect(universityIds.has(p.universityId), `${p.id}: ${p.universityId}`).toBe(true);
  });

  it('references only careers that exist in catalog.json', () => {
    for (const p of list) {
      expect(p.careerIds.length, p.id).toBeGreaterThan(0);
      expect(new Set(p.careerIds).size, `${p.id} duplicate careers`).toBe(p.careerIds.length);
      for (const c of p.careerIds) expect(careerIds.has(c), `${p.id}: ${c}`).toBe(true);
    }
  });

  it('has well-formed names, degree, duration and language', () => {
    for (const p of list) {
      expect(p.faculty.en.length, p.id).toBeGreaterThan(0);
      expect(p.faculty.ar, p.id).toMatch(ARABIC);
      expect(p.degree.length, p.id).toBeGreaterThan(0);
      expect(['faculty', 'program'], p.id).toContain(p.unitType);
      if (p.program !== null) {
        expect(p.program.en.length, p.id).toBeGreaterThan(0);
        expect(p.program.ar, p.id).toMatch(ARABIC);
      }
      if (p.durationYears !== null) {
        expect(Number.isInteger(p.durationYears), p.id).toBe(true);
        expect(p.durationYears).toBeGreaterThanOrEqual(1);
        expect(p.durationYears).toBeLessThanOrEqual(8);
      }
      expect(LANGS, p.id).toContain(p.teachingLanguage);
    }
  });

  it('uses valid accepted Thanaweya tracks', () => {
    expect(minScoreSchema.properties.track.enum).toEqual(SCORE_TRACKS);
    for (const p of list) {
      expect(p.acceptedTracks.length, p.id).toBeGreaterThan(0);
      expect(new Set(p.acceptedTracks).size, p.id).toBe(p.acceptedTracks.length);
      for (const t of p.acceptedTracks) expect(TRACKS, `${p.id}: ${t}`).toContain(t);
    }
  });

  it('has valid minScores (0-100, years 2020-2026, https sources)', () => {
    for (const p of list) {
      const seen = new Set<string>();
      for (const m of p.minScores) {
        const allowed = Object.keys(minScoreSchema.properties);
        expect(Object.keys(m).filter((k) => !allowed.includes(k)), p.id).toEqual([]);
        for (const k of minScoreSchema.required) expect(m, `${p.id}.minScores.${k}`).toHaveProperty(k);
        expect(Number.isInteger(m.year), p.id).toBe(true);
        expect(m.year, p.id).toBeGreaterThanOrEqual(2020);
        expect(m.year, p.id).toBeLessThanOrEqual(2026);
        expect(SCORE_TRACKS, `${p.id}: ${m.track}`).toContain(m.track);
        expect(m.system, p.id).toBe('thanaweya-amma');
        expect(typeof m.scorePct, p.id).toBe('number');
        expect(m.scorePct, p.id).toBeGreaterThanOrEqual(0);
        expect(m.scorePct, p.id).toBeLessThanOrEqual(100);
        expect(isHttps(m.sourceUrl), `${p.id}: ${m.sourceUrl}`).toBe(true);
        const key = `${m.year}|${m.track}|${m.kind}`;
        expect(seen.has(key), `${p.id} duplicate ${key}`).toBe(false);
        seen.add(key);
      }
    }
  });

  it('keeps scoreRaw, scoreMax and scorePct consistent for realised cutoffs', () => {
    const systems = new Set<number>(dataset.scoringSystems.map((s: any) => s.scoreMax));
    let checked = 0;
    for (const p of list) {
      for (const m of p.minScores) {
        if (m.kind === 'tansik-phase1-cutoff') {
          expect(m.scoreRaw, p.id).toBeTypeOf('number');
          expect(systems.has(m.scoreMax), `${p.id}: ${m.scoreMax}`).toBe(true);
          expect(m.scoreRaw, p.id).toBeLessThanOrEqual(m.scoreMax);
          expect(m.year <= 2024 ? 410 : 320, `${p.id} ${m.year}`).toBe(m.scoreMax);
          expect(Math.abs((m.scoreRaw / m.scoreMax) * 100 - m.scorePct), `${p.id} ${m.year}`).toBeLessThan(0.01);
          expect(m.phase, p.id).toBe(1);
          checked += 1;
        } else {
          expect(m.kind, p.id).toBe('regulatory-minimum');
          expect(m).not.toHaveProperty('scoreRaw');
        }
      }
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('only gives realised Tansik cutoffs to public universities', () => {
    const type = new Map(universities.map((u) => [u.id, u.type]));
    for (const p of list) {
      for (const m of p.minScores) {
        if (m.kind === 'tansik-phase1-cutoff') expect(type.get(p.universityId), p.id).toBe('public');
      }
    }
  });

  it('has valid fees where present', () => {
    let withFees = 0;
    for (const p of list) {
      if (p.feesEgpPerYear === null) continue;
      withFees += 1;
      const f = p.feesEgpPerYear;
      const allowed = Object.keys(feesSchema.properties);
      expect(Object.keys(f).filter((k) => !allowed.includes(k)), p.id).toEqual([]);
      expect(f.value, p.id).toBeGreaterThan(0);
      expect(Number.isInteger(f.year), p.id).toBe(true);
      expect(f.year, p.id).toBeGreaterThanOrEqual(2020);
      expect(f.year, p.id).toBeLessThanOrEqual(2026);
      expect(isHttps(f.sourceUrl), `${p.id}: ${f.sourceUrl}`).toBe(true);
    }
    expect(withFees).toBeGreaterThan(40);
  });

  it('has https website and source URLs and a valid verifiedAt', () => {
    for (const p of list) {
      expect(isHttps(p.website), `${p.id}: ${p.website}`).toBe(true);
      expect(isHttps(p.sourceUrl), `${p.id}: ${p.sourceUrl}`).toBe(true);
      expect(p.verifiedAt, p.id).toBe('2026-10-09');
      expect(isDate(p.verifiedAt), p.id).toBe(true);
      expect(p.notes === null || typeof p.notes === 'string', p.id).toBe(true);
    }
  });

  it('links every record to the website of its university', () => {
    const site = new Map(universities.map((u) => [u.id, u.website]));
    for (const p of list) expect(p.website, p.id).toBe(site.get(p.universityId));
  });
});
