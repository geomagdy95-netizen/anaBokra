'use client';

import { useLocale, useTranslations } from 'next-intl';
import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react';

import { pickText } from './localize';
import type { Gender, I18n, Locale } from './types';

const GenderContext = createContext<Gender | null>(null);

/** Gives the assessment screens the student's gender (from the profile) so Arabic can use feminine forms. */
export function AssessmentProvider({ gender, children }: { gender?: Gender | null; children: ReactNode }) {
  return <GenderContext.Provider value={gender ?? null}>{children}</GenderContext.Provider>;
}

export const useGender = () => useContext(GenderContext);

/** Instrument text (items, scale labels) in the right language and grammatical gender. */
export function useText() {
  const locale = useLocale() as Locale;
  const gender = useGender();
  return useCallback((text: I18n) => pickText(text, locale, gender), [locale, gender]);
}

/**
 * Translator for the `Assessment` messages. In Arabic, for a female student, a key that has an `<key>F`
 * sibling (feminine imperatives, adjectives) uses it; everything else is shared.
 */
export function useAT() {
  const t = useTranslations('Assessment');
  const locale = useLocale();
  const gender = useGender();
  return useCallback(
    (key: string, values?: Record<string, string | number>) =>
      locale === 'ar' && gender === 'female' && t.has(`${key}F`) ? t(`${key}F`, values) : t(key, values),
    [t, locale, gender],
  );
}

const RM = '(prefers-reduced-motion: reduce)';
const subscribeRM = (cb: () => void) => {
  const mq = window.matchMedia(RM);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeRM, () => window.matchMedia(RM).matches, () => false);
}
