import { programs, universities, universityById } from '@anabokra/content';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ExploreProvider } from '@/features/explore/personal-context';
import { ExploreShell } from '@/features/explore/shell';
import { UniversityView } from '@/features/explore/detail-views';
import { routing } from '@/i18n/routing';
import { exploreMetadata } from '@/server/explore/meta';

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => universities.map((u) => ({ locale, id: u.id })));
}

export async function generateMetadata({ params }: PageProps<'/[locale]/explore/universities/[id]'>): Promise<Metadata> {
  const { locale, id } = await params;
  const u = universityById(id);
  if (!u) return {};
  const t = await getTranslations({ locale, namespace: 'Explore.meta' });
  const name = u.name[locale as 'ar' | 'en'];
  return exploreMetadata(locale, `/explore/universities/${id}`, t('universityTitle', { name }), t('universityDescription', { name, count: programs.filter((p) => p.universityId === id).length }));
}

/** G3. Statically generated per university and locale. */
export default async function UniversityPage({ params }: PageProps<'/[locale]/explore/universities/[id]'>) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const university = universityById(id);
  if (!university) notFound();
  return (
    <ExploreShell>
      <ExploreProvider>
        <UniversityView university={university} programs={programs.filter((p) => p.universityId === id)} />
      </ExploreProvider>
    </ExploreShell>
  );
}
