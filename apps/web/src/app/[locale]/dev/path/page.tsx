import { setRequestLocale } from 'next-intl/server';

import { DevPathClient } from '@/features/path/dev-path-client';

// Dev-only page for the MX-18 grey-box path prototype.
export default async function DevPathPage({ params }: PageProps<'/[locale]/dev/path'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DevPathClient />;
}
