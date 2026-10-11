import { describe, expect, it } from 'vitest';

import { ageOn, checkGuardianId, normalizeNationalId, parseNationalId } from './national-id';

const TODAY = new Date(Date.UTC(2026, 9, 11));

// Synthetic numbers built from the documented layout (not real people): C YYMMDD GG SSSS K.
const id = (century: 2 | 3, yymmdd: string, gov = '01', seq = '1234', check = '5') => `${century}${yymmdd}${gov}${seq}${check}`;

describe('parseNationalId', () => {
  it('reads date of birth, governorate and sex', () => {
    const r = parseNationalId(id(2, '850315', '02', '0013'), TODAY);
    expect(r).toEqual({ ok: true, info: { birthDate: new Date(Date.UTC(1985, 2, 15)), governorate: '02', sex: 'male' } });
    const f = parseNationalId(id(2, '850315', '02', '0024'), TODAY);
    expect(f.ok && f.info.sex).toBe('female');
  });

  it('accepts Arabic-Indic digits, spaces and dashes', () => {
    expect(normalizeNationalId('٢٨٥ ٠٣١٥-٠٢٠٠١٣٥')).toBe('28503150200135');
    expect(parseNationalId('٢٨٥٠٣١٥٠٢٠٠١٣٥', TODAY).ok).toBe(true);
  });

  it('rejects wrong length, century, date, governorate and future births', () => {
    expect(parseNationalId('2850315020013', TODAY)).toEqual({ ok: false, error: 'format' });
    expect(parseNationalId(id(2, '850315').replace(/^2/, '1'), TODAY)).toEqual({ ok: false, error: 'century' });
    expect(parseNationalId(id(2, '850230'), TODAY)).toEqual({ ok: false, error: 'birth_date' });
    expect(parseNationalId(id(2, '851301'), TODAY)).toEqual({ ok: false, error: 'birth_date' });
    expect(parseNationalId(id(2, '850315', '99'), TODAY)).toEqual({ ok: false, error: 'governorate' });
    expect(parseNationalId(id(3, '270101'), TODAY)).toEqual({ ok: false, error: 'future' });
  });

  it('handles leap days', () => {
    expect(parseNationalId(id(3, '000229'), TODAY).ok).toBe(true);
    expect(parseNationalId(id(2, '990229'), TODAY)).toEqual({ ok: false, error: 'birth_date' });
  });
});

describe('ageOn', () => {
  it('counts whole years, before and after the birthday', () => {
    expect(ageOn(new Date(Date.UTC(1990, 9, 11)), TODAY)).toBe(36);
    expect(ageOn(new Date(Date.UTC(1990, 9, 12)), TODAY)).toBe(35);
  });
});

describe('checkGuardianId', () => {
  it('accepts an adult parent', () => {
    const r = checkGuardianId(id(2, '800101'), 'mother', undefined, TODAY);
    expect(r.ok && r.age).toBe(46);
  });

  it('rejects a guardian under 21', () => {
    expect(checkGuardianId(id(3, '060101'), 'legal_guardian', undefined, TODAY)).toEqual({ ok: false, error: 'too_young' });
  });

  it('applies the age gap to mothers and fathers only', () => {
    // 25 years old: old enough to be a legal guardian, too young to be the parent of a 15-year-old.
    const young = id(3, '010101');
    expect(checkGuardianId(young, 'father', undefined, TODAY)).toEqual({ ok: false, error: 'gap' });
    expect(checkGuardianId(young, 'legal_guardian', undefined, TODAY).ok).toBe(true);
  });

  it('passes ID errors through', () => {
    expect(checkGuardianId('123', 'mother', undefined, TODAY)).toEqual({ ok: false, error: 'format' });
  });
});
