'use client';

import { useLocale } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { AssessmentHub } from '@/features/assessment/hub';
import { ResultsState } from '@/features/assessment/results-state';
import { AssessmentProvider } from '@/features/assessment/ui-context';
import { TeaserClaim } from '@/features/public/teaser-claim';
import type { Locale } from '@/i18n/routing';

import { DeleteMyData } from './delete-data';
import { MoveData } from './move-data';
import { FirstStart } from './first-start';
import { loadLocalAssessment, type LocalPageData } from './load';
import { LocalBlocked, LocalLoading, StorageWarning } from './local-states';

/** /assessment in phase 1: everything is read from and saved to this device. */
export function LocalAssessmentHub({ retake }: { retake: boolean }) {
  const locale = useLocale() as Locale;
  const [data, setData] = useState<LocalPageData | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    void loadLocalAssessment(locale, { retake }).then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [locale, retake, version]);

  if (!data) return <LocalLoading />;
  if (data.ok === 'first-start') return <FirstStart onDone={reload} />;
  if (data.ok === false) return <LocalBlocked code={data.code} />;

  const footer = (
    <footer className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-10">
      {!data.rt.device.persistent && <StorageWarning />}
      <MoveData />
      <DeleteMyData onDeleted={reload} />
    </footer>
  );

  if (data.ok === 'results')
    return (
      <AssessmentProvider gender={data.rt.profile.gender}>
        <ResultsState completedAt={data.entry.completedAt} retake={data.entry.retake} />
        {footer}
      </AssessmentProvider>
    );

  const { progress, sessionId } = data;
  const interestsAnswered = progress.stations.find((s) => s.id === 'interests')?.answered ?? 0;
  return (
    <AssessmentProvider gender={data.rt.profile.gender}>
      <TeaserClaim sessionId={sessionId} interestsAnswered={interestsAnswered} onDone={reload} />
      <AssessmentHub
        stations={progress.stations.map((s) => ({ id: s.id, answered: s.answered, expected: s.expected, done: s.done }))}
        currentStation={progress.currentStation}
        overall={progress.overall}
        hasResult={progress.hasResult}
      />
      {footer}
    </AssessmentProvider>
  );
}
