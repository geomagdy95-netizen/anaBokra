'use client';

import { templateExplanation } from '@anabokra/ai/templates';
import { careerById, instruments } from '@anabokra/content';
import type { CareerMatch } from '@anabokra/engine';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { FinalizeRunner } from '@/features/assessment/finalize-runner';
import { AssessmentProvider } from '@/features/assessment/ui-context';
import { assembleResultView, matchesToExplain } from '@/features/results/assemble';
import { genderedT } from '@/features/results/gendered';
import { ResultsFlow } from '@/features/results/results-flow';
import { SectionDetail } from '@/features/results/section-detail';
import { buildProfileView, careersForSection, sectionItems, type RawResult, type ResultView, type Section } from '@/features/results/view';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { activeRuntime, type LocalRuntime } from '@/lib/local/runtime';
import { AssessmentError } from '@/server/assessment/errors';

import { loadLocalAssessment } from './load';
import { LocalBlocked, LocalLoading } from './local-states';

type Gender = 'female' | 'male' | null;

/** Phase 1 has no AI: every explanation comes from the engine's reasons and the templates. */
function viewOf(result: RawResult, lang: Locale, gender: Gender): ResultView {
  const explanations = matchesToExplain(result).map((m) =>
    templateExplanation(m as unknown as CareerMatch, careerById(m.careerId), lang, gender ?? 'neutral'),
  );
  return assembleResultView(result, lang, explanations);
}

type State =
  | { kind: 'loading' }
  | { kind: 'blocked'; code: string }
  | { kind: 'finalizing'; sessionId: string; gender: Gender }
  | { kind: 'none'; gender: Gender }
  | { kind: 'result'; gender: Gender; view: ResultView; interests: Record<'R' | 'I' | 'A' | 'S' | 'E' | 'C', number>; readinessDone: boolean; partial: boolean };

/** /assessment/result in phase 1: finalize on the device if needed, then reveal -> readiness -> profile. */
export function LocalResult({ sessionId }: { sessionId?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('Results');
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    void (async () => {
      const rt = await activeRuntime();
      if (!rt) return alive && setState({ kind: 'none', gender: null });
      const gender = rt.profile.gender;
      const entry = sessionId ? null : await rt.service.getEntryState(rt.userId);
      if (entry?.kind === 'open') {
        const open = await loadLocalAssessment(locale);
        if (open.ok === false) return alive && setState({ kind: 'blocked', code: open.code });
        if (open.ok === true && open.progress.canFinalize) return alive && setState({ kind: 'finalizing', sessionId: open.sessionId, gender });
      }
      let result: Awaited<ReturnType<LocalRuntime['service']['getLatestResult']>> = null;
      try {
        result = sessionId ? await rt.service.getResult(rt.userId, { sessionId }) : await rt.service.getLatestResult(rt.userId);
      } catch (e) {
        if (!(e instanceof AssessmentError)) throw e;
      }
      if (!result) return alive && setState({ kind: 'none', gender });
      const readinessDone = await rt.service.hasPostReadiness(rt.userId, result.sessionId);
      if (!alive) return;
      setState({
        kind: 'result',
        gender,
        view: viewOf(result, locale, gender),
        interests: (result.scores.interests ?? {}) as Record<'R' | 'I' | 'A' | 'S' | 'E' | 'C', number>,
        readinessDone,
        partial: (result.summary as { partial?: boolean }).partial === true,
      });
    })();
    return () => {
      alive = false;
    };
  }, [locale, sessionId]);

  if (state.kind === 'loading') return <LocalLoading />;
  if (state.kind === 'blocked') return <LocalBlocked code={state.code} />;
  const tr = (key: string) => genderedT(t as never, locale, state.gender, key);
  const rd = instruments.readiness;

  return (
    <AssessmentProvider gender={state.gender}>
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <Link href="/assessment" className="tap-link">
            {tr('back')}
          </Link>
          <LocaleSwitcher />
        </header>

        {state.kind === 'result' ? (
          <div data-testid="result" className="flex flex-1 flex-col">
            <ResultsFlow
              view={state.view}
              worldProfile={{ interests: state.interests }}
              fresh={Boolean(sessionId)}
              readinessDone={state.readinessDone}
              readiness={{ items: rd.items.map((i) => ({ id: i.id, text: i.text })), labels: rd.responseScale.labels, min: rd.responseScale.min }}
              partial={state.partial}
              share={false}
            />
          </div>
        ) : state.kind === 'finalizing' ? (
          <FinalizeRunner sessionId={state.sessionId} />
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p>{tr('notReady')}</p>
            <Button asChild>
              <Link href="/assessment">{tr('toHub')}</Link>
            </Button>
          </div>
        )}
      </main>
    </AssessmentProvider>
  );
}

/** /assessment/result/[section] in phase 1. */
export function LocalResultSection({ section }: { section: Section }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('Results');
  const [state, setState] = useState<{ gender: Gender; result: RawResult | null } | null>(null);

  useEffect(() => {
    let alive = true;
    void activeRuntime().then(async (rt) => {
      const result = rt ? await rt.service.getLatestResult(rt.userId) : null;
      if (alive) setState({ gender: rt?.profile.gender ?? null, result });
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!state) return <LocalLoading />;
  const tr = (key: string) => genderedT(t as never, locale, state.gender, key);
  return (
    <AssessmentProvider gender={state.gender}>
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <Link href="/assessment/result" className="tap-link">
            {tr('backToResults')}
          </Link>
          <LocaleSwitcher />
        </header>
        {state.result ? (
          <SectionDetail
            section={section}
            items={sectionItems(buildProfileView(state.result.scores), section)}
            suits={careersForSection(state.result.matches, section, locale)}
          />
        ) : (
          <p>{tr('notReady')}</p>
        )}
      </main>
    </AssessmentProvider>
  );
}
