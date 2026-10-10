'use client';

import { useLocale } from 'next-intl';
import { useEffect, useState, type ComponentProps } from 'react';

import { StationRunner } from '@/features/assessment/station-runner';
import { nextStationAfter } from '@/features/assessment/stations';
import { AssessmentProvider } from '@/features/assessment/ui-context';
import { useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { stationConfig, type StationId } from '@/server/assessment/config';
import { stationPayload } from '@/server/assessment/station-payload';

import { loadLocalAssessment } from './load';
import { LocalBlocked, LocalLoading } from './local-states';

type Ready = Omit<ComponentProps<typeof StationRunner>, 'station' | 'next'> & { gender: 'female' | 'male' | null };

/** /assessment/[station] in phase 1: one station, resumed exactly where the student stopped. */
export function LocalStation({ station }: { station: StationId }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [state, setState] = useState<Ready | { error: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const data = await loadLocalAssessment(locale);
      if (data.ok === 'results' || data.ok === 'first-start') return router.replace('/assessment');
      if (data.ok === false) return alive && setState({ error: data.code });
      const { rt, sessionId, progress } = data;
      const st = progress.stations.find((s) => s.id === station);
      // Stations open in order: only finished ones and the current one.
      if (!st || (!st.done && progress.currentStation !== station)) return router.replace('/assessment');
      const resume = await rt.service.getResume(rt.userId, { sessionId });
      const cfg = stationConfig('full', station)!;
      if (!alive) return;
      setState({
        sessionId,
        gender: rt.profile.gender,
        payload: cfg.id === 'context' ? null : stationPayload(cfg.id),
        initialAnswers: Object.fromEntries(resume.responses.filter((r) => r.instrumentId === cfg.instrumentId).map((r) => [r.itemId, r.value])),
        initialContext: { ...resume.context, governorate: rt.profile.governorate },
        initialRanking: resume.valuesRanking,
        expected: st.expected,
        overall: progress.overall,
        done: st.done,
        firstTime: progress.stations.every((s) => !s.done && s.answered === 0),
      });
    })();
    return () => {
      alive = false;
    };
  }, [locale, station, router]);

  if (!state) return <LocalLoading />;
  if ('error' in state) return <LocalBlocked code={state.error} />;
  const { gender, ...runner } = state;
  return (
    <AssessmentProvider gender={gender}>
      <StationRunner
        key={`${runner.sessionId}:${station}`}
        {...runner}
        station={station}
        next={nextStationAfter(station)?.id ?? null}
      />
    </AssessmentProvider>
  );
}
