'use client';

import { templateExplanation } from '@anabokra/ai/templates';
import { careerById, instruments } from '@anabokra/content';
import type { CareerMatch } from '@anabokra/engine';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FinalizeRunner } from '@/features/assessment/finalize-runner';
import { AppShell } from '@/features/journey/app-shell';
import { JourneyGate } from '@/features/journey/journey-gate';
import { RatingCard } from '@/features/journey/rating-card';
import { assembleResultView, matchesToExplain } from '@/features/results/assemble';
import { genderedT } from '@/features/results/gendered';
import { ResultsFlow } from '@/features/results/results-flow';
import { SectionDetail } from '@/features/results/section-detail';
import { buildProfileView, careersForSection, sectionItems, type RawResult, type ResultView, type Section } from '@/features/results/view';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import type { JourneyData } from '@/lib/journey/journey';
import type { LocalRuntime } from '@/lib/local/runtime';
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
  | { kind: 'finalizing'; sessionId: string }
  | { kind: 'none' }
  | { kind: 'result'; view: ResultView; interests: Record<'R' | 'I' | 'A' | 'S' | 'E' | 'C', number>; readinessDone: boolean; partial: boolean };

/**
 * /assessment/result in phase 1: finalize on the device if needed, then reveal -> readiness -> profile.
 * The journey gate comes first, so a locked profile asks for the password like every other tab.
 */
export function LocalResult({ sessionId }: { sessionId?: string }) {
  return <JourneyGate>{(data) => <Result data={data} sessionId={sessionId} />}</JourneyGate>;
}

function Result({ data, sessionId }: { data: JourneyData; sessionId?: string }) {
  const { rt } = data;
  const locale = useLocale() as Locale;
  const t = useTranslations('Results');
  const [state, setState] = useState<State>({ kind: 'loading' });
  const gender: Gender = rt.profile.gender;

  useEffect(() => {
    let alive = true;
    void (async () => {
      const entry = sessionId ? null : await rt.service.getEntryState(rt.userId);
      if (entry?.kind === 'open') {
        const open = await loadLocalAssessment(locale);
        if (open.ok === false) return alive && setState({ kind: 'blocked', code: open.code });
        if (open.ok === true && open.progress.canFinalize) return alive && setState({ kind: 'finalizing', sessionId: open.sessionId });
      }
      let result: Awaited<ReturnType<LocalRuntime['service']['getLatestResult']>> = null;
      try {
        result = sessionId ? await rt.service.getResult(rt.userId, { sessionId }) : await rt.service.getLatestResult(rt.userId);
      } catch (e) {
        if (!(e instanceof AssessmentError)) throw e;
      }
      if (!result) return alive && setState({ kind: 'none' });
      const readinessDone = await rt.service.hasPostReadiness(rt.userId, result.sessionId);
      if (!alive) return;
      setState({
        kind: 'result',
        view: viewOf(result, locale, gender),
        interests: (result.scores.interests ?? {}) as Record<'R' | 'I' | 'A' | 'S' | 'E' | 'C', number>,
        readinessDone,
        partial: (result.summary as { partial?: boolean }).partial === true,
      });
    })();
    return () => {
      alive = false;
    };
  }, [rt, locale, sessionId, gender]);

  if (state.kind === 'loading') return <LocalLoading />;
  if (state.kind === 'blocked') return <LocalBlocked code={state.code} />;
  const tr = (key: string) => genderedT(t as never, locale, gender, key);
  const rd = instruments.readiness;

  return (
    <AppShell tab="home" title={tr('overview.title')} back="/journey" testId="result-screen">
      {state.kind === 'result' ? (
        <div data-testid="result" className="flex flex-col pt-1">
          <ResultsFlow
            view={state.view}
            worldProfile={{ interests: state.interests }}
            fresh={Boolean(sessionId)}
            readinessDone={state.readinessDone}
            readiness={{ items: rd.items.map((i) => ({ id: i.id, text: i.text })), labels: rd.responseScale.labels, min: rd.responseScale.min }}
            partial={state.partial}
            share={false}
            title={false}
            // No reload after rating: it would rebuild the runtime and replay this page; the card thanks in place.
            after={<RatingCard data={data} onChanged={() => {}} />}
          />
        </div>
      ) : state.kind === 'finalizing' ? (
        <FinalizeRunner sessionId={state.sessionId} />
      ) : (
        <NotReady text={tr('notReady')} cta={tr('toHub')} />
      )}
    </AppShell>
  );
}

function NotReady({ text, cta }: { text: string; cta: string }) {
  return (
    <section className="surface mt-4 flex flex-col items-center gap-4 p-6 text-center" data-testid="result-not-ready">
      <p>{text}</p>
      <Button asChild size="lg">
        <Link href="/journey">{cta}</Link>
      </Button>
    </section>
  );
}

/** /assessment/result/[section] in phase 1. */
export function LocalResultSection({ section }: { section: Section }) {
  return <JourneyGate>{(data) => <ResultSection data={data} section={section} />}</JourneyGate>;
}

function ResultSection({ data, section }: { data: JourneyData; section: Section }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('Results');
  const { rt } = data;
  const [result, setResult] = useState<RawResult | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void rt.service.getLatestResult(rt.userId).then((r) => alive && setResult(r));
    return () => {
      alive = false;
    };
  }, [rt]);

  if (result === undefined) return <LocalLoading />;
  const tr = (key: string) => genderedT(t as never, locale, rt.profile.gender, key);
  return (
    <AppShell tab="home" title={tr(`sections.${section}`)} back="/assessment/result" testId="result-section-screen">
      {result ? (
        <div className="pt-1">
          <SectionDetail
            section={section}
            items={sectionItems(buildProfileView(result.scores), section)}
            suits={careersForSection(result.matches, section, locale)}
            title={false}
          />
        </div>
      ) : (
        <NotReady text={tr('notReady')} cta={tr('toHub')} />
      )}
    </AppShell>
  );
}
