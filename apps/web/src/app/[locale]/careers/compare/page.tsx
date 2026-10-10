import { careerById } from '@anabokra/content';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CompareTable, ComparePicker } from '@/features/careers/compare-table';
import { parseCompareIds } from '@/features/careers/filters';
import { CareersShell } from '@/features/careers/shell';
import { MAX_COMPARE, MIN_COMPARE } from '@/features/careers/types';
import { getCatalog } from '@/server/careers/catalog';
import { loadPersonal } from '@/server/careers/personal';
import { getCareerPage } from '@/server/content/career-pages';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/[locale]/careers/compare'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Careers.meta' });
  return { title: t('compareTitle'), robots: { index: false } };
}

/** F4. `?ids=a,b,c` (or repeated `ids`), capped at 3; fewer than 2 shows the picker only. */
export default async function ComparePage({ params, searchParams }: PageProps<'/[locale]/careers/compare'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Careers.compare');
  const sp = await searchParams;
  const rawIds = sp.ids;
  const ids = parseCompareIds(rawIds, (id) => Boolean(careerById(id)));
  const tooMany = (Array.isArray(rawIds) ? rawIds.join(',') : (rawIds ?? '')).split(',').filter(Boolean).length > MAX_COMPARE;

  const catalog = getCatalog();
  const items = ids.flatMap((id) => catalog.find((c) => c.id === id) ?? []);
  const personal = await loadPersonal();
  const fits = Object.fromEntries(Object.entries(personal.fits).map(([id, f]) => [id, f.fit]));
  const pages = Object.fromEntries(ids.map((id) => [id, getCareerPage(id)]));

  return (
    <CareersShell wide>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="max-w-prose text-muted-foreground">{t('intro', { min: MIN_COMPARE, max: MAX_COMPARE })}</p>
        <ComparePicker items={catalog} selected={ids} />
        {tooMany ? (
          <p role="status" className="text-sm text-destructive">
            {t('limit', { max: MAX_COMPARE })}
          </p>
        ) : null}
        {items.length >= MIN_COMPARE ? (
          <CompareTable items={items} pages={pages} fits={fits} hasResult={personal.hasResult} />
        ) : (
          <p className="text-muted-foreground">{t('needMore', { min: MIN_COMPARE })}</p>
        )}
      </div>
    </CareersShell>
  );
}
