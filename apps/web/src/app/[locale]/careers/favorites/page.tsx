import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { FavoritesList } from '@/features/careers/favorites-list';
import { PersonalProvider } from '@/features/careers/personal-context';
import { CareersShell } from '@/features/careers/shell';
import { getCatalog } from '@/server/careers/catalog';
import { loadPersonal } from '@/server/careers/personal';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/[locale]/careers/favorites'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Careers.meta' });
  return { title: t('favoritesTitle'), robots: { index: false } };
}

/** F5. Per-user, so rendered on request. */
export default async function FavoritesPage({ params }: PageProps<'/[locale]/careers/favorites'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Careers.favorites');
  const personal = await loadPersonal();

  return (
    <CareersShell>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <PersonalProvider initial={personal}>
          <FavoritesList catalog={getCatalog()} />
        </PersonalProvider>
      </div>
    </CareersShell>
  );
}
