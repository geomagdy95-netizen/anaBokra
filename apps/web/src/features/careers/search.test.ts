import { describe, expect, it } from 'vitest';

import { matchesQuery, normalizeText } from './search';

describe('normalizeText', () => {
  it('strips Arabic diacritics and tatweel', () => {
    expect(normalizeText('مُهَنْدِس')).toBe('مهندس');
    expect(normalizeText('مـهـنـدس')).toBe('مهندس');
  });

  it('folds alef, ya, ta marbuta and hamza variants', () => {
    expect(normalizeText('أخصائي')).toBe(normalizeText('اخصائي'));
    expect(normalizeText('إدارة')).toBe(normalizeText('اداره'));
    expect(normalizeText('صيدلي')).toBe(normalizeText('صيدلى'));
    expect(normalizeText('مهندسة')).toBe(normalizeText('مهندسه'));
  });

  it('maps Arabic-Indic digits and lowercases English', () => {
    expect(normalizeText('٣ Software')).toBe('3 software');
  });
});

describe('matchesQuery', () => {
  it('matches Arabic names with or without diacritics, on either side', () => {
    expect(matchesQuery('مهندس', 'مُهَنْدِس برمجيات')).toBe(true);
    expect(matchesQuery('مُهَنْدِس', 'مهندس برمجيات')).toBe(true);
    expect(matchesQuery('أخصائي', 'اخصائي نفسي')).toBe(true);
  });

  it('requires every term and is case-insensitive for English', () => {
    expect(matchesQuery('software ENG', 'Software Engineer')).toBe(true);
    expect(matchesQuery('software nurse', 'Software Engineer')).toBe(false);
  });

  it('an empty query matches everything', () => {
    expect(matchesQuery('   ', 'anything')).toBe(true);
  });
});
