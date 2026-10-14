'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { useGender } from '@/features/assessment/ui-context';

/** Translator for the `Games` messages, using the `<key>F` feminine form in Arabic when the user is female. */
export function useGT() {
  const t = useTranslations('Games');
  const locale = useLocale();
  const gender = useGender();
  return useCallback(
    (key: string, values?: Record<string, string | number>) =>
      locale === 'ar' && gender === 'female' && t.has(`${key}F`) ? t(`${key}F`, values) : t(key, values),
    [t, locale, gender],
  );
}
