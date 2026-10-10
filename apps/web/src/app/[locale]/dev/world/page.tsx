import { careers, clusters } from '@anabokra/content';
import { setRequestLocale } from 'next-intl/server';

import { DevWorldClient } from '@/features/world/dev-world-client';
import type { GroupId, GroupInfo } from '@/features/world/types';

// Dev-only page for the island world prototype (group islands, bridges, results states).
export default async function DevWorldPage({ params }: PageProps<'/[locale]/dev/world'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Only names and counts go to the client, not the career library.
  const groups: GroupInfo[] = clusters.map((c) => ({
    id: c.id as GroupId,
    name: c.name,
    careers: careers.filter((k) => k.cluster === c.id).length,
  }));
  return <DevWorldClient groups={groups} />;
}
