import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { DevCareerClient } from '@/features/journey/dev-career-client';
import { getCareerPage } from '@/server/content/career-pages';

// Dev-only page: a career quest and its result from sample answers (?career=pharmacist&view=quest|result&answered=3&mood=keen). Nothing is saved.
export default async function DevCareerPage({ params, searchParams }: PageProps<'/[locale]/dev/career'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const id = String((await searchParams).career ?? 'pharmacist');
  const page = getCareerPage(id);
  if (!page) notFound();
  return <DevCareerClient careerId={id} page={page} />;
}
