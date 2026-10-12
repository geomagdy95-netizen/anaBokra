import { setRequestLocale } from 'next-intl/server';

import { DevPathsClient } from '@/features/journey/dev-paths-client';

// Dev-only page: try the draft Verify (path) tasks. Nothing is saved.
export default async function DevPathsPage({ params }: PageProps<'/[locale]/dev/paths'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DevPathsClient />;
}
