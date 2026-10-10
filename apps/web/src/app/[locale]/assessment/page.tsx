import { setRequestLocale } from 'next-intl/server';

import { AssessmentBlocked } from '@/features/assessment/blocked';
import { ResultsState } from '@/features/assessment/results-state';
import { AssessmentHub } from '@/features/assessment/hub';
import { AssessmentProvider } from '@/features/assessment/ui-context';
import { LocalAssessmentHub } from '@/features/local/local-hub';
import { TeaserClaim } from '@/features/public/teaser-claim';
import type { Locale } from '@/i18n/routing';
import { DATA_MODE } from '@/lib/data-mode';
import { loadAssessment } from '@/server/assessment/page-data';

export const dynamic = 'force-dynamic';

// D1 hub: station map + per-station previews, progress from getProgress.
export default async function AssessmentPage({ params, searchParams }: PageProps<'/[locale]/assessment'>) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  if (DATA_MODE === 'local') return <LocalAssessmentHub retake={sp.retake === '1'} />;
  const data = await loadAssessment(locale as Locale, '/assessment', { retake: sp.retake === '1' });
  if (data.ok === 'results')
    return (
      <AssessmentProvider gender={data.profile.gender}>
        <ResultsState completedAt={data.entry.completedAt} retake={data.entry.retake} />
      </AssessmentProvider>
    );
  if (!data.ok) return <AssessmentBlocked code={data.code} />;
  const { progress, profile, sessionId } = data;
  const interestsAnswered = progress.stations.find((s) => s.id === 'interests')?.answered ?? 0;

  return (
    <AssessmentProvider gender={profile.gender}>
      <TeaserClaim sessionId={sessionId} interestsAnswered={interestsAnswered} />
      <AssessmentHub
        stations={progress.stations.map((s) => ({ id: s.id, answered: s.answered, expected: s.expected, done: s.done }))}
        currentStation={progress.currentStation}
        overall={progress.overall}
        hasResult={progress.hasResult}
      />
    </AssessmentProvider>
  );
}
