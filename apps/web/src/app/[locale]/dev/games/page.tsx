import { setRequestLocale } from 'next-intl/server';

import { DevGamesClient } from '@/features/games/dev-games-client';

// Dev-only page: try the game prototypes (pattern logic, patience). Nothing is saved.
export default async function DevGamesPage({ params }: PageProps<'/[locale]/dev/games'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DevGamesClient />;
}
