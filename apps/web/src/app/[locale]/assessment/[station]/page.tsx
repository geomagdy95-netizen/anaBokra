import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { AssessmentBlocked } from '@/features/assessment/blocked';
import { StationRunner } from '@/features/assessment/station-runner';
import { nextStationAfter } from '@/features/assessment/stations';
import { AssessmentProvider } from '@/features/assessment/ui-context';
import { redirect } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { STATION_IDS, stationConfig } from '@/server/assessment/config';
import { loadAssessment } from '@/server/assessment/page-data';
import { stationPayload } from '@/server/assessment/station-payload';

export const dynamic = 'force-dynamic';

// D1-D11: one station, resumed exactly where the student stopped.
export default async function StationPage({ params }: PageProps<'/[locale]/assessment/[station]'>) {
  const { locale, station } = await params;
  setRequestLocale(locale);
  if (!(STATION_IDS as readonly string[]).includes(station)) notFound();

  const data = await loadAssessment(locale as Locale, `/assessment/${station}`);
  if (data.ok === 'results') return redirect({ href: '/assessment', locale: locale as Locale });
  if (!data.ok) return <AssessmentBlocked code={data.code} />;
  const { runtime, sessionId, progress, profile } = data;

  const st = progress.stations.find((s) => s.id === station);
  if (!st) notFound();
  // Stations open in order: only finished ones and the current one.
  if (!st.done && progress.currentStation !== station) return redirect({ href: '/assessment', locale: locale as Locale });

  const resume = await runtime.service.getResume(runtime.userId, { sessionId });
  const cfg = stationConfig('full', station)!;
  const payload = cfg.id === 'context' ? null : stationPayload(cfg.id);
  const initialAnswers = Object.fromEntries(
    resume.responses.filter((r) => r.instrumentId === cfg.instrumentId).map((r) => [r.itemId, r.value]),
  );
  const next = nextStationAfter(station)?.id ?? null;

  return (
    <AssessmentProvider gender={profile.gender}>
      <StationRunner
        key={`${sessionId}:${station}`}
        sessionId={sessionId}
        station={station}
        payload={payload}
        initialAnswers={initialAnswers}
        initialContext={{ ...resume.context, governorate: profile.governorate }}
        initialRanking={resume.valuesRanking}
        expected={st.expected}
        overall={progress.overall}
        done={st.done}
        firstTime={progress.stations.every((s) => !s.done && s.answered === 0)}
        next={next}
      />
    </AssessmentProvider>
  );
}
