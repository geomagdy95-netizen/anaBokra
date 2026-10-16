import { redirect } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

/** The map used to be its own tab; it is home now. Old links (and ?island=) still land on it. */
export default async function JourneyMapPage({ params, searchParams }: PageProps<'/[locale]/journey/map'>) {
  const { locale } = await params;
  const island = (await searchParams).island;
  redirect({ href: typeof island === 'string' ? { pathname: '/journey', query: { island } } : '/journey', locale });
}
