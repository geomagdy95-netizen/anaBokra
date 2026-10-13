import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { AccountPage } from '@/features/journey/account-page';
import { DATA_MODE } from '@/lib/data-mode';

export const dynamic = 'force-dynamic';

/** Account: nickname, password and every phase 1 setting. */
export default async function JourneyAccountPage({ params }: PageProps<'/[locale]/journey/account'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (DATA_MODE !== 'local') notFound();
  return <AccountPage />;
}
