import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { DiscoverPage } from '@/features/journey/discover-page';
import { DATA_MODE } from '@/lib/data-mode';

export const dynamic = 'force-dynamic';

/** My island: Discover, my careers and results (docs/product/discover-verify.md). Opened from the map. */
export default async function JourneyMePage({ params }: PageProps<'/[locale]/journey/me'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (DATA_MODE !== 'local') notFound();
  // DiscoverPage reads ?task= to open a station straight away.
  return (
    <Suspense>
      <DiscoverPage />
    </Suspense>
  );
}
