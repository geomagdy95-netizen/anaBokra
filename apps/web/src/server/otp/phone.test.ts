import { describe, expect, it } from 'vitest';

import { maskPhone, normalizeAuthPhone, normalizePhone, toWaDigits } from './phone';

describe('normalizePhone (Egypt)', () => {
  it.each([
    ['01012345678', '+201012345678'],
    ['010 1234 5678', '+201012345678'],
    ['010-1234-5678', '+201012345678'],
    ['1012345678', '+201012345678'],
    ['+201012345678', '+201012345678'],
    ['+20 10 1234 5678', '+201012345678'],
    ['00201012345678', '+201012345678'],
    ['201012345678', '+201012345678'],
    ['020 10 1234 5678', '+201012345678'],
    ['(+20) 100 123 4567', '+201001234567'],
    ['01112345678', '+201112345678'],
    ['01212345678', '+201212345678'],
    ['01512345678', '+201512345678'],
    ['٠١٠١٢٣٤٥٦٧٨', '+201012345678'], // Arabic-Indic digits
    ['۰۱۰۱۲۳۴۵۶۷۸', '+201012345678'], // Persian digits
    ['‎+20 101 234 5678', '+201012345678'], // LTR mark
  ])('%s -> %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    '',
    'abc',
    '0101234567', // too short
    '010123456789', // too long
    '01312345678', // unknown operator prefix
    '0221234567', // landline
    '+2013123456789',
    '+20101234567', // short
    '+0123456789',
    '12345',
    '010 1234 5678 ext 5',
  ])('rejects %j', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it('accepts other countries only with an explicit + or 00', () => {
    expect(normalizePhone('+966512345678')).toBe('+966512345678');
    expect(normalizePhone('00966512345678')).toBe('+966512345678');
    expect(normalizePhone('966512345678')).toBeNull();
    expect(normalizePhone('+1 (415) 555-2671')).toBe('+14155552671');
  });

  it('rejects non-strings and absurd lengths', () => {
    expect(normalizePhone(undefined as unknown as string)).toBeNull();
    expect(normalizePhone('1'.repeat(100))).toBeNull();
  });
});

describe('helpers', () => {
  it('normalizeAuthPhone accepts the Supabase storage form (no +)', () => {
    expect(normalizeAuthPhone('201012345678')).toBe('+201012345678');
    expect(normalizeAuthPhone('+201012345678')).toBe('+201012345678');
    expect(normalizeAuthPhone('966512345678')).toBe('+966512345678');
    expect(normalizeAuthPhone('2013')).toBeNull();
  });
  it('toWaDigits drops the plus', () => expect(toWaDigits('+201012345678')).toBe('201012345678'));
  it('maskPhone hides the middle', () => expect(maskPhone('+201012345678')).toBe('+201•••••5678'));
});
