import type { Gender, I18n, Locale } from './types';

/**
 * Text for one locale. Arabic uses the feminine variant (`arF`) only when the student's profile
 * gender is female and a variant exists; unknown gender falls back to the masculine / neutral text.
 */
export function pickText(text: I18n, locale: Locale, gender?: Gender | null): string {
  if (locale === 'en') return text.en;
  return gender === 'female' && text.arF ? text.arF : text.ar;
}
