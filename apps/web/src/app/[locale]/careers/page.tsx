import { clusters } from '@anabokra/content';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CareerBrowser } from '@/features/careers/career-browser';
import { PersonalProvider } from '@/features/careers/personal-context';
import { CareersShell } from '@/features/careers/shell';
import { routing } from '@/i18n/routing';
import { getCatalog } from '@/server/careers/catalog';
import { siteUrl } from '@/server/careers/site';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<'/[locale]/careers'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Careers.meta' });
  return {
    metadataBase: siteUrl(),
    title: t('browseTitle'),
    description: t('browseDescription'),
    alternates: {
      canonical: `/${locale}/careers`,
      languages: { ar: '/ar/careers', en: '/en/careers', 'x-default': '/ar/careers' },
    },
  };
}

/** F1. Static: the full catalog is rendered on the server; fit % is layered on after sign-in data loads. */
export default async function CareersPage({ params }: PageProps<'/[locale]/careers'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Careers.browser');

  return (
    <CareersShell wide>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="max-w-prose text-muted-foreground">{t('intro')}</p>
        </div>
        <PersonalProvider>
          <CareerBrowser items={getCatalog()} clusterOptions={clusters} />
        </PersonalProvider>
      </div>
    </CareersShell>
  );
}
