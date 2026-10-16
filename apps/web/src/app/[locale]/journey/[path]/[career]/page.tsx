import { careerById } from '@anabokra/content';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { CareerIslandPage } from '@/features/journey/career-island';
import { DATA_MODE } from '@/lib/data-mode';
import { getCareerPage } from '@/server/content/career-pages';

export const dynamic = 'force-dynamic';

/** A career (L2) island inside its group. Phase 1 only; only this career's page is sent to the client. */
export default async function JourneyCareerPage({ params }: PageProps<'/[locale]/journey/[path]/[career]'>) {
  const { locale, path, career } = await params;
  setRequestLocale(locale);
  const page = getCareerPage(career);
  if (DATA_MODE !== 'local' || careerById(career)?.cluster !== path || !page) notFound();
  return <CareerIslandPage careerId={career} page={page} />;
}
