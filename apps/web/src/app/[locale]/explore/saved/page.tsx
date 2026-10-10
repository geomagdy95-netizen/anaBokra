import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getExploreCatalog } from '@/features/explore/catalog';
import { ExploreProvider } from '@/features/explore/personal-context';
import { SavedList } from '@/features/explore/saved-list';
import { ExploreShell } from '@/features/explore/shell';
import { exploreMetadata } from '@/server/explore/meta';
import { loadExplorePersonal } from '@/server/explore/personal';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/[locale]/explore/saved'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Explore.meta' });
  return exploreMetadata(locale, '/explore/saved', t('savedTitle'), t('savedDescription'), { index: false });
}

/** G7. Per-user, rendered on request. */
export default async function SavedPage({ params }: PageProps<'/[locale]/explore/saved'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Explore.savedPage');
  const personal = await loadExplorePersonal();
  const c = getExploreCatalog();
  return (
    <ExploreShell>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <ExploreProvider initial={personal}>
          <SavedList programs={c.programs} universities={c.universities} providers={c.providers} />
        </ExploreProvider>
      </div>
    </ExploreShell>
  );
}
