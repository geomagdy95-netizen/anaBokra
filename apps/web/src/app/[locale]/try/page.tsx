import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PublicShell } from '@/features/public/shell';
import { TeaserClient } from '@/features/public/teaser-client';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<'/[locale]/try'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Public.teaser' });
  return { title: t('metaTitle'), description: t('metaDescription') };
}

/** A2–A4 teaser: no account needed; answers stay in the browser until signup. */
export default async function TryPage({ params }: PageProps<'/[locale]/try'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <PublicShell>
      <TeaserClient />
    </PublicShell>
  );
}
