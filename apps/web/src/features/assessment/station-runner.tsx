'use client';

import { Pause } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';

import { assessmentApi } from './api';
import { ContextForm, type ContextValues } from './context-form';
import { FinishingPanel, PausePanel, StationComplete, StationIntro } from './panels';
import { SaveIndicator } from './primitives';
import { SaveFailure } from './save-queue';
import { SequenceStation, type SequenceItem } from './sequence-station';
import { stationUi } from './stations';
import type { AnswerMap, StationPayload } from './types';
import { useAT } from './ui-context';
import { useAnswers } from './use-answers';
import { ValuesStation } from './values-station';

export interface StationRunnerProps {
  sessionId: string;
  station: string;
  payload: StationPayload | null;
  initialAnswers: AnswerMap;
  initialContext: ContextValues;
  initialRanking: string[];
  /** Questions in this station (context: number of fields). */
  expected: number;
  /** Answered across the whole assessment (for the pause screen). */
  overall: { answered: number; expected: number };
  done: boolean;
  firstTime: boolean;
  next: string | null;
}

type Phase = 'intro' | 'play' | 'pause' | 'finishing' | 'complete';

function buildItems(payload: StationPayload | null): SequenceItem[] {
  if (!payload || payload.kind === 'values') return [];
  if (payload.kind === 'likert') return payload.items.map((i) => ({ id: i.id, kind: 'scale', text: i.text }));
  return [
    ...payload.self.map<SequenceItem>((i) => ({ id: i.id, kind: 'scale', text: i.text })),
    ...payload.performance.map<SequenceItem>((p) => ({ id: p.id, kind: 'puzzle', puzzle: p })),
  ];
}

/** One station, start to finish: intro (D1) -> play (D2..D7, D8, D11) -> pause (D9) -> complete (D10). */
export function StationRunner(props: StationRunnerProps) {
  const { sessionId, station, payload, initialAnswers, initialContext, initialRanking, expected, overall, done, firstTime, next } = props;
  const at = useAT();
  const router = useRouter();
  const tNav = useTranslations('Assessment');
  const { answers, setAnswer, flush, status, fatal } = useAnswers({ sessionId, station, initial: initialAnswers });
  const items = useMemo(() => buildItems(payload), [payload]);
  const ui = stationUi(station)!;

  const total = payload?.kind === 'values' ? payload.cards.length : station === 'context' ? expected : items.length;
  const ids = useMemo(() => (payload?.kind === 'values' ? payload.cards.map((c) => c.id) : items.map((i) => i.id)), [payload, items]);
  const answeredCount = ids.filter((id) => answers[id] !== undefined).length;

  const initialAnswered = ids.filter((id) => initialAnswers[id] !== undefined).length;
  const overallNow = { answered: Math.max(0, overall.answered - initialAnswered + answeredCount), expected: overall.expected };

  const [phase, setPhase] = useState<Phase>(() => {
    if (done) return 'complete';
    const initiallyAnswered = ids.filter((id) => initialAnswers[id] !== undefined).length;
    if (station !== 'context' && station !== 'values' && ids.length > 0 && initiallyAnswered === ids.length) return 'finishing';
    return initiallyAnswered > 0 || (station === 'context' && expected > 0 && Object.values(initialContext).some((v) => v != null)) ? 'play' : 'intro';
  });
  const [startIndex, setStartIndex] = useState(() => {
    const i = items.findIndex((x) => initialAnswers[x.id] === undefined);
    return i < 0 ? 0 : i;
  });
  const [finishError, setFinishError] = useState<string | null>(null);
  const ranking = useRef<string[] | undefined>(undefined);
  const started = useRef(false);

  const finish = useCallback(
    async (rank?: string[]) => {
      if (rank) ranking.current = rank;
      setPhase('finishing');
      setFinishError(null);
      try {
        await flush();
        await assessmentApi.completeStation(sessionId, station, ranking.current);
        setPhase('complete');
        router.refresh();
      } catch (e) {
        setFinishError(e instanceof SaveFailure ? (e.code ?? 'server_error') : 'server_error');
      }
    },
    [flush, router, sessionId, station],
  );

  // Everything was answered in an earlier visit but the station was never closed: close it now.
  useEffect(() => {
    if (phase === 'finishing' && !started.current) {
      started.current = true;
      void finish();
    }
  }, [phase, finish]);

  const onAnswer = useCallback((id: string, value: number, ms: number, cursor: Record<string, unknown>) => setAnswer(id, value, ms, cursor), [setAnswer]);

  const resumePlay = () => {
    const i = items.findIndex((x) => answers[x.id] === undefined);
    setStartIndex(i < 0 ? 0 : i);
    setPhase('play');
  };

  const review = () => {
    setStartIndex(0);
    setPhase('play');
  };

  const title = at(`stations.${station}.title`);
  const hadActivity = answeredCount > 0 || phase === 'pause';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/assessment" className="rounded-sm text-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {at('intro.backToMap')}
        </Link>
        <LocaleSwitcher />
      </header>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="station-title">
            {title}
          </h1>
          <SaveIndicator status={status} hadActivity={hadActivity} />
        </div>
        {phase === 'play' && station !== 'context' && (
          <Button
            type="button"
            variant="outline"
            data-testid="pause-button"
            onClick={() => {
              void flush().catch(() => {});
              setPhase('pause');
            }}
          >
            <Pause aria-hidden="true" />
            {at('pause.button')}
          </Button>
        )}
      </div>

      {fatal && (
        <p role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">
          {tNav.has(`errors.${fatal}`) ? at(`errors.${fatal}`) : at('errors.server_error')}
        </p>
      )}

      {phase === 'intro' && (
        <StationIntro station={station} items={total} firstTime={firstTime} resuming={answeredCount > 0} onStart={() => setPhase('play')} />
      )}

      {phase === 'play' && payload?.kind === 'values' && (
        <ValuesStation payload={payload} answers={answers} initialRanking={initialRanking} onAnswer={onAnswer} onFinish={(r) => void finish(r)} />
      )}

      {phase === 'play' && payload && payload.kind !== 'values' && items.length > 0 && (
        <SequenceStation
          key={`${station}-${startIndex}`}
          station={station}
          mode={ui.mode === 'swipe' ? 'swipe' : 'scale'}
          items={items}
          scale={payload.scale}
          answers={answers}
          startIndex={startIndex}
          promptKey={station}
          onAnswer={onAnswer}
          onFinish={() => void finish()}
        />
      )}

      {phase === 'play' && station === 'context' && (
        <ContextForm sessionId={sessionId} initial={initialContext} onFinish={() => void finish()} />
      )}

      {phase === 'pause' && (
        <PausePanel answered={answeredCount} total={total} overall={overallNow} status={status} onContinue={resumePlay} />
      )}

      {phase === 'finishing' && <FinishingPanel error={finishError} onRetry={() => void finish()} />}

      {phase === 'complete' && <StationComplete station={station} next={next} onReview={station === 'context' ? undefined : review} />}
    </main>
  );
}
