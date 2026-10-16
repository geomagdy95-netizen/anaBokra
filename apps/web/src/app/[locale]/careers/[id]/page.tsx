import { careerById, careers, clusters, industryById } from '@anabokra/content';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CareerView } from '@/features/careers/career-view';
import { PersonalProvider } from '@/features/careers/personal-context';
import { CareersShell } from '@/features/careers/shell';
import type { Locale } from '@/features/careers/types';
import { AppShell } from '@/features/journey/app-shell';
import { routing } from '@/i18n/routing';
import { DATA_MODE } from '@/lib/data-mode';
import { getCareerPage } from '@/server/content/career-pages';
import { siteUrl } from '@/server/careers/site';

// Only catalog careers have a page; anything else is a 404 rather than a runtime render.
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => careers.map((c) => ({ locale, id: c.id })));
}

const clip = (text: string, max = 155) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

export async function generateMetadata({ params }: PageProps<'/[locale]/careers/[id]'>): Promise<Metadata> {
  const { locale, id } = await params;
  const career = careerById(id);
  if (!career) return {};
  const lang = locale as Locale;
  const t = await getTranslations({ locale, namespace: 'Careers.meta' });
  const page = getCareerPage(id);
  const name = career.name[lang];
  const cluster = clusters.find((c) => c.id === career.cluster)?.name[lang] ?? '';
  const lead = page?.snapshot?.hook?.[lang] ?? '';
  const description = lead ? clip(lead) : t('careerDescription', { name, cluster });
  const title = t('careerTitle', { name });
  const path = `/careers/${id}`;
  return {
    metadataBase: siteUrl(),
    title,
    description,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { ar: `/ar${path}`, en: `/en${path}`, 'x-default': `/ar${path}` },
    },
    openGraph: { title, description, type: 'article', locale: locale === 'ar' ? 'ar_EG' : 'en_US', alternateLocale: locale === 'ar' ? 'en_US' : 'ar_EG' },
  };
}

/**
 * F2. Statically generated per career and locale; personalised parts (fit, favorite) load on the client.
 * Phase 1 shows it inside the app shell (opened from Explore, Verify and the results), without the
 * career list around it.
 */
export default async function CareerPageRoute({ params }: PageProps<'/[locale]/careers/[id]'>) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const career = careerById(id);
  if (!career) notFound();
  const page = getCareerPage(id);
  const industry = industryById(page?.industryId ?? career.cluster);
  const cluster = clusters.find((c) => c.id === career.cluster);

  if (DATA_MODE === 'local')
    return (
      <AppShell tab="explore" back="/journey" backToPrevious testId="career-screen">
        <CareerView career={career} cluster={cluster} page={page} industry={industry} path={`/careers/${id}`} framed />
      </AppShell>
    );

  return (
    <CareersShell>
      <PersonalProvider>
        <CareerView
          career={career}
          cluster={cluster}
          page={page}
          industry={industry}
          path={`/careers/${id}`}
        />
      </PersonalProvider>
    </CareersShell>
  );
}
