import { careers, programById, programs, universityById } from '@anabokra/content';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { programName } from '@/features/explore/catalog';
import { ProgramView } from '@/features/explore/detail-views';
import { ExploreProvider } from '@/features/explore/personal-context';
import { ExploreShell } from '@/features/explore/shell';
import { routing } from '@/i18n/routing';
import { careerNames, exploreMetadata } from '@/server/explore/meta';

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => programs.map((p) => ({ locale, id: p.id })));
}

export async function generateMetadata({ params }: PageProps<'/[locale]/explore/programs/[id]'>): Promise<Metadata> {
  const { locale, id } = await params;
  const p = programById(id);
  if (!p) return {};
  const l = locale as 'ar' | 'en';
  const t = await getTranslations({ locale, namespace: 'Explore.meta' });
  const uni = universityById(p.universityId)?.name[l] ?? '';
  const name = programName(p)[l];
  return exploreMetadata(locale, `/explore/programs/${id}`, t('programTitle', { name, university: uni }), t('programDescription', { name, university: uni }));
}

/** G4. Statically generated per program and locale. */
export default async function ProgramPage({ params }: PageProps<'/[locale]/explore/programs/[id]'>) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const program = programById(id);
  if (!program) notFound();
  const wanted = new Set(program.careerIds);
  return (
    <ExploreShell>
      <ExploreProvider>
        <ProgramView program={program} university={universityById(program.universityId)} careers={careerNames(careers.filter((c) => wanted.has(c.id)))} />
      </ExploreProvider>
    </ExploreShell>
  );
}
