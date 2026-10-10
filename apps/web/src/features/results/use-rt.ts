'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { useGender } from '@/features/assessment/ui-context';

import { genderedT } from './gendered';

type Values = Record<string, string | number>;

/** Translator for the `Results` messages with feminine Arabic where the profile is female. */
export function useRT() {
  const t = useTranslations('Results');
  const locale = useLocale();
  const gender = useGender();
  return useCallback((key: string, values?: Values) => genderedT(t as never, locale, gender, key, values), [t, locale, gender]);
}
