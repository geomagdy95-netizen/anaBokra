import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { MapHome } from '@/features/journey/map-home';
import { DATA_MODE } from '@/lib/data-mode';

export const dynamic = 'force-dynamic';

/** Home is the map (docs/product/world-spec.md). Phase 1 only: everything runs on the phone. */
export default async function JourneyPage({ params }: PageProps<'/[locale]/journey'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (DATA_MODE !== 'local') notFound();
  // MapHome reads ?island= (open a sheet) and ?view=list.
  return (
    <Suspense>
      <MapHome />
    </Suspense>
  );
}
