import { setRequestLocale } from 'next-intl/server';

import { DevLocalClient } from '@/features/local/dev-local-client';

// Dev-only check that the assessment runs and persists on the device (phase 1, local-first).
export default async function DevLocalPage({ params }: PageProps<'/[locale]/dev/local'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DevLocalClient />;
}
