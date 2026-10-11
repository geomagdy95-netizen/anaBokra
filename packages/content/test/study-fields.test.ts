import { describe, expect, it } from 'vitest';
import { STUDY_FIELDS } from '@anabokra/engine';
import { careers } from '../src';
import studyFieldsJson from '../careers/study-fields.json';

const tagged = studyFieldsJson.fields as Record<string, string[]>;

describe('career study fields', () => {
  it('tags every career exactly once, with known fields only', () => {
    expect(Object.keys(tagged).sort()).toEqual(careers.map((c) => c.id).sort());
    for (const [id, fields] of Object.entries(tagged)) {
      for (const f of fields) expect(STUDY_FIELDS, id).toContain(f);
      expect(new Set(fields).size, id).toBe(fields.length);
      expect(fields, id).not.toContain('other');
    }
  });

  it("uses every field a user can pick (except 'other'), so no field is a dead end", () => {
    const used = new Set(Object.values(tagged).flat());
    for (const f of STUDY_FIELDS) if (f !== 'other') expect(used, f).toContain(f);
  });

  it('merges the fields into the careers used for matching', () => {
    expect(careers.find((c) => c.id === 'physician')?.egypt?.fields).toEqual(['medicine']);
    expect(careers.find((c) => c.id === 'entrepreneur')?.egypt).toBeUndefined();
  });
});
