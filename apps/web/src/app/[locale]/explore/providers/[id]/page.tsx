import { careers, providerById, providers } from '@anabokra/content';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ProviderView } from '@/features/explore/detail-views';
import { ExploreProvider } from '@/features/explore/personal-context';
import { ExploreShell } from '@/features/explore/shell';
import { routing } from '@/i18n/routing';
import { careerNames, exploreMetadata } from '@/server/explore/meta';

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => providers.map((p) => ({ locale, id: p.id })));
}

export async function generateMetadata({ params }: PageProps<'/[locale]/explore/providers/[id]'>): Promise<Metadata> {
  const { locale, id } = await params;
  const p = providerById(id);
  if (!p) return {};
  const t = await getTranslations({ locale, namespace: 'Explore.meta' });
  return exploreMetadata(locale, `/explore/providers/${id}`, t('providerTitle', { name: p.name[locale as 'ar' | 'en'] }), p.audience[locale as 'ar' | 'en'].slice(0, 155));
}

/** G5. Statically generated per provider and locale. */
export default async function ProviderPage({ params }: PageProps<'/[locale]/explore/providers/[id]'>) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const provider = providerById(id);
  if (!provider) notFound();
  const wanted = new Set(provider.careerIds);
  return (
    <ExploreShell>
      <ExploreProvider>
        <ProviderView provider={provider} careers={careerNames(careers.filter((c) => wanted.has(c.id)))} />
      </ExploreProvider>
    </ExploreShell>
  );
}
