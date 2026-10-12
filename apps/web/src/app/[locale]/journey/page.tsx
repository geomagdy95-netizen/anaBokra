import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { DiscoverPage } from '@/features/journey/discover-page';
import { DATA_MODE } from '@/lib/data-mode';

export const dynamic = 'force-dynamic';

/** My island · Discover (docs/product/discover-verify.md). Phase 1 only: everything runs on the phone. */
export default async function JourneyPage({ params }: PageProps<'/[locale]/journey'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (DATA_MODE !== 'local') notFound();
  return <DiscoverPage />;
}
