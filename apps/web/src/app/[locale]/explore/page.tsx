import { careers } from '@anabokra/content';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getExploreCatalog } from '@/features/explore/catalog';
import { ExploreHome } from '@/features/explore/explore-home';
import { ExploreProvider } from '@/features/explore/personal-context';
import { ExploreShell } from '@/features/explore/shell';
import { routing } from '@/i18n/routing';
import { careerNames, exploreMetadata } from '@/server/explore/meta';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<'/[locale]/explore'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Explore.meta' });
  return exploreMetadata(locale, '/explore', t('homeTitle'), t('homeDescription'));
}

/** G1. Static; personal sections (top careers, near you) load on the client. */
export default async function ExplorePage({ params }: PageProps<'/[locale]/explore'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Explore.home');
  return (
    <ExploreShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="max-w-prose text-muted-foreground">{t('intro')}</p>
        </div>
        <ExploreProvider>
          <ExploreHome catalog={getExploreCatalog()} careers={careerNames(careers)} />
        </ExploreProvider>
      </div>
    </ExploreShell>
  );
}
