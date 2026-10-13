'use client';

import { useLocale } from 'next-intl';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { AssessmentProvider } from '@/features/assessment/ui-context';
import { FirstStart } from '@/features/local/first-start';
import { LocalBlocked, LocalLoading } from '@/features/local/local-states';
import { keepStoredData } from '@/features/pwa/pwa-setup';
import { UnlockScreen } from '@/features/local/unlock-screen';
import type { Locale } from '@/i18n/routing';
import { loadJourney, type JourneyData, type JourneyLoad } from '@/lib/journey/journey';

/**
 * Loads the journey from the phone for any tab, and shows what has to come first: first start, the
 * unlock screen, or a refusal. Opt-in uploads that couldn't be sent earlier are retried on load (both
 * skip when there's nothing new), and the browser is asked to keep the app's storage.
 */
export function JourneyGate({ children }: { children: (data: JourneyData, reload: () => void) => ReactNode }) {
  const locale = useLocale() as Locale;
  const [state, setState] = useState<JourneyLoad | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    void loadJourney(locale).then((s) => {
      if (!alive) return;
      setState(s);
      if (s.kind === 'ready') {
        keepStoredData();
        void import('@/lib/local/stats').then(({ syncStats }) => syncStats(s.rt));
        void import('@/lib/local/research').then(({ syncResearch }) => syncResearch(s.rt));
      }
    });
    return () => {
      alive = false;
    };
  }, [locale, version]);

  if (!state) return <LocalLoading />;
  if (state.kind === 'first-start') return <FirstStart onDone={reload} />;
  if (state.kind === 'locked') return <UnlockScreen nickname={state.nickname} onUnlocked={reload} />;
  if (state.kind === 'blocked') return <LocalBlocked code={state.code} />;
  return <AssessmentProvider gender={state.rt.profile.gender}>{children(state, reload)}</AssessmentProvider>;
}
