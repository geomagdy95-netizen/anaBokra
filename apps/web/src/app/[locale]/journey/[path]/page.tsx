import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { VerifyPage } from '@/features/journey/verify-page';
import { DATA_MODE } from '@/lib/data-mode';

export const dynamic = 'force-dynamic';

/** Verify a path (career-group) island. Phase 1 only. */
export default async function JourneyPathPage({ params }: PageProps<'/[locale]/journey/[path]'>) {
  const { locale, path } = await params;
  setRequestLocale(locale);
  if (DATA_MODE !== 'local' || !/^[a-z]{2,20}$/.test(path)) notFound();
  return <VerifyPage pathId={path} />;
}
