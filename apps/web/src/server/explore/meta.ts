import type { Metadata } from 'next';

import { siteUrl } from '@/server/careers/site';

/** Canonical + hreflang alternates for an /explore path (path without the locale prefix). */
export function exploreMetadata(locale: string, path: string, title: string, description: string, opts: { index?: boolean } = {}): Metadata {
  return {
    metadataBase: siteUrl(),
    title,
    description,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { ar: `/ar${path}`, en: `/en${path}`, 'x-default': `/ar${path}` },
    },
    openGraph: { title, description, type: 'website', locale: locale === 'ar' ? 'ar_EG' : 'en_US', alternateLocale: locale === 'ar' ? 'en_US' : 'ar_EG' },
    ...(opts.index === false ? { robots: { index: false } } : {}),
  };
}

export const careerNames = (careers: { id: string; name: { ar: string; en: string } }[]) => careers.map((c) => ({ id: c.id, name: c.name }));
