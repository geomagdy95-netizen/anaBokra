'use client';

import { careerById, clusters } from '@anabokra/content';
import { Check, Lock } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ProgressBar, useNumberFormat } from '@/features/assessment/primitives';
import { AssessmentProvider, useText } from '@/features/assessment/ui-context';
import { FirstStart } from '@/features/local/first-start';
import { loadLocalAssessment } from '@/features/local/load';
import { LocalBlocked, LocalLoading } from '@/features/local/local-states';
import type { Locale } from '@/i18n/routing';
import { discoverPlan, discoverStatus } from '@/lib/journey/discover-plan';
import type { LocalRuntime } from '@/lib/local/runtime';
import type { AssessmentErrorCode } from '@/server/assessment/errors';
import type { Preview } from '@/server/assessment/scoring';
import { cn } from '@/lib/utils';

import { discoverSteps } from './steps';
import { TaskRunner } from './task-runner';
import { useJT } from './use-jt';

type State =
  | { kind: 'loading' }
  | { kind: 'first-start' }
  | { kind: 'blocked'; code: AssessmentErrorCode }
  | { kind: 'ready'; rt: LocalRuntime; sessionId: string; open: boolean; answers: Record<string, number>; preview: Preview };

async function loadDiscover(locale: Locale): Promise<State> {
  const data = await loadLocalAssessment(locale);
  if (data.ok === 'first-start') return { kind: 'first-start' };
  if (data.ok === false) return { kind: 'blocked', code: data.code };
  const sessionId = data.ok === 'results' ? data.entry.sessionId : data.sessionId;
  const resume = await data.rt.service.getResume(data.rt.userId, { sessionId });
  const preview = await data.rt.service.preview(data.rt.userId, { sessionId });
  return {
    kind: 'ready',
    rt: data.rt,
    sessionId,
    open: data.ok === true,
    answers: Object.fromEntries(resume.responses.map((r) => [r.itemId, r.value])),
    preview,
  };
}

/**
 * My island · Discover (docs/product/discover-verify.md §4): ten short tasks of validated questions
 * in mixed formats, saved on the phone as they're answered, with path suggestions that grow as the
 * user goes (an early guess after task 4, suggestions after task 8).
 */
export function DiscoverPage() {
  const locale = useLocale() as Locale;
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    void loadDiscover(locale).then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, [locale, version]);

  if (state.kind === 'loading') return <LocalLoading />;
  if (state.kind === 'first-start') return <FirstStart onDone={reload} />;
  if (state.kind === 'blocked') return <LocalBlocked code={state.code} />;
  return (
    <AssessmentProvider gender={state.rt.profile.gender}>
      <Island state={state} onChanged={reload} />
    </AssessmentProvider>
  );
}

function Island({ state, onChanged }: { state: Extract<State, { kind: 'ready' }>; onChanged: () => void }) {
  const jt = useJT();
  const nf = useNumberFormat();
  const plan = discoverPlan();
  const status = discoverStatus(new Set(Object.keys(state.answers)));
  const [running, setRunning] = useState<number | null>(null);
  const [reward, setReward] = useState<Preview | null>(null);

  if (running !== null) {
    const task = plan[running - 1]!;
    return (
      <TaskRunner
        title={`${jt('task', { n: nf.format(task.n) })} · ${jt(`taskTitles.${task.n}`)}`}
        steps={discoverSteps(task)}
        initial={state.answers}
        onAnswer={async (step, value, ms) => {
          if (!state.open || !('instrumentId' in step)) return false;
          try {
            await state.rt.service.saveResponses(state.rt.userId, {
              sessionId: state.sessionId,
              station: step.instrumentId,
              responses: [{ itemId: step.id, value, ms }],
            });
            return true;
          } catch {
            return false;
          }
        }}
        onDone={async () => {
          setReward(await state.rt.service.preview(state.rt.userId, { sessionId: state.sessionId }));
          setRunning(null);
          onChanged();
        }}
        onClose={() => {
          setRunning(null);
          onChanged();
        }}
      />
    );
  }

  if (reward) return <Reward preview={reward} done={status.doneCount} onBack={() => setReward(null)} />;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-6" data-testid="discover">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">{jt('discover')}</p>
          <h1 className="text-2xl font-semibold">{jt('title')}</h1>
        </div>
        <LocaleSwitcher />
      </header>
      <p className="text-sm text-muted-foreground">{jt('intro')}</p>
      <div className="flex flex-col gap-1">
        <ProgressBar value={status.doneCount} max={plan.length} label={jt('title')} />
        <p className="text-xs text-muted-foreground tabular-nums">{jt('progress', { done: nf.format(status.doneCount), total: nf.format(plan.length) })}</p>
      </div>

      {state.preview.stage !== 'none' && <Suggestions preview={state.preview} />}

      <ol className="flex flex-col gap-2" data-testid="discover-tasks">
        {plan.map((task, i) => {
          const done = status.done[i]!;
          const next = status.next === task.n;
          const locked = !done && !next;
          const minutes = Math.max(1, Math.round((task.items.length * 8) / 60));
          return (
            <li key={task.n}>
              <button
                type="button"
                disabled={locked || (!state.open && !done)}
                onClick={() => setRunning(task.n)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border p-3 text-start transition-colors',
                  next ? 'border-primary bg-primary/5 shadow-sm' : done ? 'bg-card' : 'bg-muted/40 opacity-70',
                )}
                data-testid={`task-${task.n}`}
                data-state={done ? 'done' : next ? 'next' : 'locked'}
              >
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                    done ? 'bg-primary text-primary-foreground' : next ? 'border-2 border-primary text-primary' : 'bg-muted text-muted-foreground',
                  )}
                  aria-hidden="true"
                >
                  {done ? <Check className="size-4" /> : locked ? <Lock className="size-4" /> : nf.format(task.n)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {jt('task', { n: nf.format(task.n) })} · {jt(`taskTitles.${task.n}`)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {jt('taskMeta', { count: nf.format(task.items.length), min: nf.format(minutes) })} ·{' '}
                    {jt(`state.${done ? 'done' : next ? 'next' : 'locked'}`)}
                  </span>
                </span>
                {next && <span className="rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground">{jt('start')}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </main>
  );
}

function Suggestions({ preview }: { preview: Preview }) {
  const jt = useJT();
  const tx = useText();
  const locale = useLocale();
  const list = new Intl.ListFormat(locale, { style: 'narrow', type: 'conjunction' });
  const early = preview.stage === 'early';
  const top = preview.groups.slice(0, 3);
  return (
    <section
      className={cn('rounded-2xl border p-4', early ? 'border-dashed' : 'border-primary bg-primary/5')}
      data-testid="suggestions"
      data-stage={preview.stage}
    >
      <h2 className="font-semibold">{jt(early ? 'reward.earlyTitle' : 'reward.suggestedTitle')}</h2>
      {preview.flat ? (
        <p className="mt-1 text-sm" data-testid="suggestions-flat">
          {jt('reward.flat')}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">{jt(early ? 'reward.early' : 'reward.suggested')}</p>
      )}
      {!preview.flat && (
        <ul className="mt-3 flex flex-col gap-2">
          {top.map((g) => {
            const name = clusters.find((c) => c.id === g.cluster)?.name;
            return (
              <li key={g.cluster} className={cn('rounded-xl border bg-card p-3', early && 'opacity-80')} data-testid="suggested-path">
                <p className="font-medium">{name ? tx(name) : g.cluster}</p>
                <p className="text-xs text-muted-foreground">
                  {jt('reward.top', {
                    list: list.format(
                      g.careerIds.slice(0, 2).map((id) => {
                        const c = careerById(id);
                        return c ? tx(c.name) : id;
                      }),
                    ),
                  })}
                </p>
                {!early && <p className="mt-1 text-xs font-medium text-primary">{jt('reward.verifySoon')}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Reward({ preview, done, onBack }: { preview: Preview; done: number; onBack: () => void }) {
  const jt = useJT();
  const nf = useNumberFormat();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-8" data-testid="reward">
      <p aria-hidden="true" className="text-center text-5xl motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-500">
        🏝️
      </p>
      <h1 className="text-center text-2xl font-semibold">{jt('reward.title')}</h1>
      <p className="text-center text-sm text-muted-foreground tabular-nums">
        {jt('progress', { done: nf.format(done), total: nf.format(discoverPlan().length) })}
      </p>
      {preview.stage === 'none' ? <p className="rounded-xl bg-muted p-4 text-sm">{jt('reward.none')}</p> : <Suggestions preview={preview} />}
      <Button size="lg" onClick={onBack} data-testid="reward-back">
        {jt('back')}
      </Button>
    </main>
  );
}
