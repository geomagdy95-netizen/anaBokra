import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ar', 'en'],
  defaultLocale: 'ar',
});

export type Locale = (typeof routing.locales)[number];

/** Text direction per locale. */
export const dirOf = (locale: Locale): 'rtl' | 'ltr' => (locale === 'ar' ? 'rtl' : 'ltr');
