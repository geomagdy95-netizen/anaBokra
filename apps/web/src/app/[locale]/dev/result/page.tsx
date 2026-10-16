import { setRequestLocale } from 'next-intl/server';

import { DevResultClient } from '@/features/journey/dev-result-client';

// Dev-only page: a path result from sample answers (?path=tourism&fit=55&mood=mixed). Nothing is saved.
export default async function DevResultPage({ params }: PageProps<'/[locale]/dev/result'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DevResultClient />;
}
