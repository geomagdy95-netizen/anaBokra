import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { SavedPage } from '@/features/journey/saved-page';
import { DATA_MODE } from '@/lib/data-mode';

export const dynamic = 'force-dynamic';

/** Saved: the paths the user bookmarked. Phase 1 only: kept on the phone. */
export default async function JourneySavedPage({ params }: PageProps<'/[locale]/journey/saved'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (DATA_MODE !== 'local') notFound();
  return <SavedPage />;
}
