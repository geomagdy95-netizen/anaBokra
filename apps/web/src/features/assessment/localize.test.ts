import { describe, expect, it } from 'vitest';

import { pickText } from './localize';

const both = { en: 'Quick check', ar: 'اختار', arF: 'اختاري' };
const noF = { en: 'Like', ar: 'بحبه' };

describe('Arabic feminine variants (arF)', () => {
  it('uses arF for a female student in Arabic', () => {
    expect(pickText(both, 'ar', 'female')).toBe('اختاري');
  });
  it('uses the masculine / neutral text for male or unknown gender', () => {
    expect(pickText(both, 'ar', 'male')).toBe('اختار');
    expect(pickText(both, 'ar', null)).toBe('اختار');
    expect(pickText(both, 'ar')).toBe('اختار');
  });
  it('falls back to ar when there is no arF', () => {
    expect(pickText(noF, 'ar', 'female')).toBe('بحبه');
  });
  it('never uses arF in English', () => {
    expect(pickText(both, 'en', 'female')).toBe('Quick check');
  });
});
