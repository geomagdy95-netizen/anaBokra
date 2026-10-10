import { programById } from '@anabokra/content';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { toProgramRow } from '@/features/explore/catalog';
import { CompareView } from '@/features/explore/compare-view';
import { parseCompareIds } from '@/features/explore/filters';
import { ExploreProvider } from '@/features/explore/personal-context';
import { ExploreShell } from '@/features/explore/shell';
import { exploreMetadata } from '@/server/explore/meta';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/[locale]/explore/compare'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Explore.meta' });
  return exploreMetadata(locale, '/explore/compare', t('compareTitle'), t('compareDescription'), { index: false });
}

/** G6. The program ids come from ?ids=a,b,c (max 3); fit is layered on from the client. */
export default async function ComparePage({ params, searchParams }: PageProps<'/[locale]/explore/compare'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Explore.compare');
  const sp = await searchParams;
  const raw = Array.isArray(sp.ids) ? sp.ids[0] : sp.ids;
  const ids = parseCompareIds(raw);
  const rows = ids.flatMap((id) => {
    const p = programById(id);
    return p ? [toProgramRow(p)] : [];
  });
  return (
    <ExploreShell>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <ExploreProvider>
          <CompareView rows={rows} requested={ids.length} />
        </ExploreProvider>
      </div>
    </ExploreShell>
  );
}
