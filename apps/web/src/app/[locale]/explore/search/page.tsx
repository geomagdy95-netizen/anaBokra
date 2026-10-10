import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { getExploreCatalog } from '@/features/explore/catalog';
import { ExploreProvider } from '@/features/explore/personal-context';
import { SearchView } from '@/features/explore/search-view';
import { ExploreShell } from '@/features/explore/shell';
import { routing } from '@/i18n/routing';
import { exploreMetadata } from '@/server/explore/meta';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<'/[locale]/explore/search'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Explore.meta' });
  return exploreMetadata(locale, '/explore/search', t('searchTitle'), t('searchDescription'));
}

/** G2. Static shell; filters run on the client over the compact catalog. */
export default async function SearchPage({ params }: PageProps<'/[locale]/explore/search'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Explore.search');
  return (
    <ExploreShell>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <ExploreProvider>
          <Suspense fallback={<p role="status">{t('loading')}</p>}>
            <SearchView catalog={getExploreCatalog()} />
          </Suspense>
        </ExploreProvider>
      </div>
    </ExploreShell>
  );
}
