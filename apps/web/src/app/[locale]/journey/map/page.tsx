import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { ExplorePage } from '@/features/journey/explore-page';
import { DATA_MODE } from '@/lib/data-mode';

export const dynamic = 'force-dynamic';

/** Explore: every path island on the map or in a list, with the island sheet. Phase 1 only. */
export default async function JourneyMapPage({ params }: PageProps<'/[locale]/journey/map'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (DATA_MODE !== 'local') notFound();
  // ExplorePage reads ?island= to open a sheet straight away.
  return (
    <Suspense>
      <ExplorePage />
    </Suspense>
  );
}
