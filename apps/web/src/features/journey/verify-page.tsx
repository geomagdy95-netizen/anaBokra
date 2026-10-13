'use client';

import { careerById, clusters, pathById, type PathContent, type PathTask } from '@anabokra/content';
import type { I18n } from '@anabokra/engine';
import { Check, X } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { pathArt } from '@/features/art/task-art';
import { useNumberFormat } from '@/features/assessment/primitives';
import { useText } from '@/features/assessment/ui-context';
import { ValuesStation } from '@/features/assessment/values-station';
import type { ValuesPayload } from '@/features/assessment/types';
import { Link } from '@/i18n/navigation';
import { maybeFinalize, type JourneyData } from '@/lib/journey/journey';
import { saveVerifyAnswer, saveVerifyResult, scoreVerify, taskDone, type VerifyResult } from '@/lib/journey/verify';
import { cn } from '@/lib/utils';
import { stationPayload } from '@/server/assessment/station-payload';

import { AppShell } from './app-shell';
import { JourneyGate } from './journey-gate';
import { LocalLoading } from '@/features/local/local-states';
import { RatingCard } from './rating-card';
import { pathSteps } from './steps';
import { TaskRunner } from './task-runner';
import { useJT } from './use-jt';

/**
 * Verify a path (docs/product/discover-verify.md §5): values once, then the path's three tasks,
 * then "fits well / partly / worth rethinking" with reasons and the path's careers ranked.
 */
export function VerifyPage({ pathId }: { pathId: string }) {
  return <JourneyGate>{(data, reload) => <Verify data={data} pathId={pathId} onChanged={reload} />}</JourneyGate>;
}

type Running = { kind: 'values' } | { kind: 'task'; task: PathTask } | null;

function Verify({ data, pathId, onChanged }: { data: JourneyData; pathId: string; onChanged: () => void }) {
  const jt = useJT();
  const tx = useText();
  const path = pathById(pathId);
  const group = clusters.find((c) => c.id === pathId);
  const rec = data.journey.paths[pathId];
  const answers = rec?.answers ?? {};
  const [running, setRunning] = useState<Running>(null);
  const [showResult, setShowResult] = useState(Boolean(rec?.result));
  const groupName = group ? tx(group.name) : pathId;

  const frame = (testId: string, children: ReactNode, extra?: Record<string, string>) => (
    <AppShell tab="explore" back="/journey/map" title={groupName} subtitle={jt('verify.eyebrow')} testId={testId}>
      <div className="flex flex-col gap-5" {...extra}>
        {children}
      </div>
    </AppShell>
  );

  if (!path || data.preview.stage !== 'suggested')
    return frame(
      'verify-unavailable',
      <>
        <p className="rounded-2xl bg-secondary p-4 text-sm">{!path ? jt('verify.noContent') : jt('verify.notReady')}</p>
        <Button asChild variant="outline">
          <Link href="/journey/map">{jt('back')}</Link>
        </Button>
      </>,
    );

  if (running?.kind === 'values') return <ValuesTask data={data} onDone={() => (setRunning(null), onChanged())} />;
  if (running?.kind === 'task')
    return (
      <TaskRunner
        title={tx(running.task.title)}
        intro={tx(running.task.intro)}
        steps={pathSteps(running.task, pathId)}
        art={pathArt(pathId, running.task.id)}
        initial={answers}
        onAnswer={async (step, value) => {
          try {
            await saveVerifyAnswer(data.rt.device.kv, data.rt.userId, pathId, step.id, value);
            return true;
          } catch {
            return false;
          }
        }}
        onDone={() => {
          setRunning(null);
          onChanged();
        }}
        onClose={() => {
          setRunning(null);
          onChanged();
        }}
      />
    );

  if (showResult && rec?.result)
    return frame(
      'verify-result-page',
      <Result path={path} result={rec.result} onAgain={() => setShowResult(false)} rating={<RatingCard data={data} onChanged={onChanged} />} />,
      { 'data-band': rec.result.band },
    );

  const tasksDone = path.tasks.map((t) => taskDone(t, answers));
  const allDone = data.valuesDone && tasksDone.every(Boolean);

  const finish = async () => {
    const groupFit = data.preview.groups.find((g) => g.cluster === pathId)?.fit ?? 0;
    const result = scoreVerify(path, answers, { groupFit, careerFits: data.preview.fits });
    await saveVerifyResult(data.rt.device.kv, data.rt.userId, result);
    await maybeFinalize(data);
    setShowResult(true);
    onChanged();
  };

  const steps: { key: string; title: string; done: boolean; onStart: () => void }[] = [
    ...(data.valuesDone && !data.open ? [] : [{ key: 'values', title: jt('verify.values'), done: data.valuesDone, onStart: () => setRunning({ kind: 'values' }) }]),
    ...path.tasks.map((t, i) => ({ key: t.id, title: tx(t.title), done: tasksDone[i]!, onStart: () => setRunning({ kind: 'task', task: t }) })),
  ];
  const next = steps.findIndex((s) => !s.done);

  return frame(
    'verify',
    <>
      <p className="text-sm text-muted-foreground">{jt('verify.intro')}</p>
      <ol className="flex flex-col gap-2">
        {steps.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              disabled={i > next && next !== -1}
              onClick={s.onStart}
              data-testid={`verify-task-${s.key}`}
              data-state={s.done ? 'done' : i === next ? 'next' : 'locked'}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border p-3 text-start',
                i === next ? 'border-primary bg-primary/5 shadow-sm' : s.done ? 'bg-card' : 'bg-muted/40 opacity-70',
              )}
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                  s.done ? 'bg-primary text-primary-foreground' : 'border-2 border-primary text-primary',
                )}
                aria-hidden="true"
              >
                {s.done ? <Check className="size-4" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{s.title}</span>
                {s.key === 'values' && <span className="block text-xs text-muted-foreground">{jt('verify.valuesIntro')}</span>}
              </span>
              {i === next && <span className="rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground">{jt('start')}</span>}
            </button>
          </li>
        ))}
      </ol>
      {allDone && (
        <Button size="lg" onClick={() => void finish()} data-testid="verify-result">
          {jt('verify.result')}
        </Button>
      )}
    </>,
  );
}

/** "What you need from work": the values card sort, asked once and reused for every path. */
function ValuesTask({ data, onDone }: { data: JourneyData; onDone: () => void }) {
  const jt = useJT();
  const [state, setState] = useState<{ answers: Record<string, number>; ranking: string[] } | null>(null);
  useEffect(() => {
    let alive = true;
    void data.rt.service.getResume(data.rt.userId, { sessionId: data.sessionId }).then((r) => {
      if (!alive) return;
      setState({ answers: Object.fromEntries(r.responses.filter((x) => x.instrumentId === 'values').map((x) => [x.itemId, x.value])), ranking: r.valuesRanking });
    });
    return () => {
      alive = false;
    };
  }, [data]);
  if (!state) return <LocalLoading />;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6" data-testid="values-task">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{jt('verify.values')}</h1>
          <p className="text-xs text-muted-foreground">{jt('verify.valuesIntro')}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onDone} aria-label={jt('back')}>
          <X className="size-5" />
        </Button>
      </header>
      <ValuesStation
        payload={stationPayload('values') as ValuesPayload}
        answers={state.answers}
        initialRanking={state.ranking}
        onAnswer={(cardId, weight, ms) => {
          void data.rt.service.saveResponses(data.rt.userId, { sessionId: data.sessionId, station: 'values', responses: [{ itemId: cardId, value: weight, ms }] });
        }}
        onFinish={async (ranking) => {
          await data.rt.service.completeStation(data.rt.userId, { sessionId: data.sessionId, station: 'values', valuesRanking: ranking });
          onDone();
        }}
      />
    </main>
  );
}

const BAND_STYLE = { fitsWell: 'border-primary bg-primary/10', fitsPartly: 'border-amber-500/60 bg-amber-50 dark:bg-amber-950/30', rethink: 'border-muted-foreground/30 bg-muted' };
const BAND_ICON = { fitsWell: '🌟', fitsPartly: '🧭', rethink: '🤔' };

function Result({ path, result, onAgain, rating }: { path: PathContent; result: VerifyResult; onAgain: () => void; rating: ReactNode }) {
  const jt = useJT();
  const tx = useText();
  const nf = useNumberFormat();
  const locale = useLocale();
  const list = new Intl.ListFormat(locale, { style: 'narrow', type: 'conjunction' });
  const items = new Map(path.tasks.flatMap((t) => t.items.map((i) => [i.id, i] as const)));
  const story = (id: string) => tx((items.get(id) as { text: I18n }).text);
  const choice = (id: string) => items.get(id) as { a: I18n; b: I18n; path: 'a' | 'b'; careers?: string[] };
  const careerName = (id: string) => {
    const c = careerById(id);
    return c ? tx(c.name) : id;
  };

  return (
    <>
      <section className={cn('rounded-2xl border-2 p-5', BAND_STYLE[result.band])}>
        <p aria-hidden="true" className="text-4xl">
          {BAND_ICON[result.band]}
        </p>
        <h2 className="mt-2 text-2xl font-semibold" data-testid="verify-band">
          {jt(`verify.bands.${result.band}`)}
        </h2>
        <p className="mt-1 text-sm">{jt(`verify.bandText.${result.band}`)}</p>
      </section>

      {result.enjoyed.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold">{jt('verify.enjoyed')}</h3>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm">
            {result.enjoyed.map((id) => (
              <li key={id}>{story(id)}</li>
            ))}
          </ul>
        </section>
      )}

      {result.accepted.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold">{jt('verify.accepted')}</h3>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm">
            {result.accepted.slice(0, 3).map((id) => {
              const c = choice(id);
              return <li key={id}>{tx(c.path === 'a' ? c.a : c.b)}</li>;
            })}
          </ul>
        </section>
      )}

      {result.turnedDown.length > 0 && (
        <section data-testid="verify-keep">
          <h3 className="text-sm font-semibold">{jt('verify.keep')}</h3>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm">
            {result.turnedDown.map((id) => {
              const c = choice(id);
              const chosen = tx(c.path === 'a' ? c.b : c.a);
              const typical = tx(c.path === 'a' ? c.a : c.b);
              return (
                <li key={id}>
                  {jt('verify.over', { chosen, path: typical })}
                  {c.careers?.length ? <span className="text-muted-foreground"> ({jt('verify.common', { list: list.format(c.careers.map(careerName)) })})</span> : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {rating}

      <section>
        <h3 className="text-sm font-semibold">{jt('verify.careers')}</h3>
        <ol className="mt-2 flex flex-col gap-2" data-testid="verify-careers">
          {result.careers.map((c, i) => (
            <li key={c.careerId} className="rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">
                  <span className="tabular-nums">{nf.format(i + 1)}. </span>
                  {careerName(c.careerId)}
                </p>
                <Link href={`/careers/${c.careerId}`} className="tap-link shrink-0 text-xs">
                  {jt('verify.openCareer')}
                </Link>
              </div>
              {c.cautions.map((id) => {
                const ch = choice(id);
                return (
                  <p key={id} className="mt-1 text-xs text-muted-foreground">
                    {jt('verify.caution', { text: tx(ch.path === 'a' ? ch.a : ch.b) })}
                  </p>
                );
              })}
            </li>
          ))}
        </ol>
      </section>

      <p className="text-xs text-muted-foreground">{jt('verify.disclaimer')}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/journey/map">{jt('verify.other')}</Link>
        </Button>
        <Button variant="outline" onClick={onAgain}>
          {jt('verify.again')}
        </Button>
      </div>
    </>
  );
}
