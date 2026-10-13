'use client';

import { careerById, clusters, pathById } from '@anabokra/content';
import { Check, ChevronRight, Lock, Map as MapIcon } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useRef, useState } from 'react';

import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { ProgressBar, useNumberFormat } from '@/features/assessment/primitives';
import { useText } from '@/features/assessment/ui-context';
import { StorageWarning } from '@/features/local/local-states';
import { InstallHint } from '@/features/pwa/install-hint';
import { Link } from '@/i18n/navigation';
import { discoverPlan } from '@/lib/journey/discover-plan';
import { FOLLOW_UP_DAYS, maybeFinalize, type JourneyData } from '@/lib/journey/journey';
import type { VerifyBand } from '@/lib/journey/verify';
import { cn } from '@/lib/utils';
import type { Preview } from '@/server/assessment/scoring';

import { AccountButton, AppShell } from './app-shell';
import { JourneyGate } from './journey-gate';
import { JourneyMap } from './journey-map';
import { discoverSteps, readinessSteps } from './steps';
import { TaskRunner } from './task-runner';
import { discoverArt } from '@/features/art/task-art';
import { useJT } from './use-jt';

const DAY = 86_400_000;

/**
 * Home: my island (docs/product/discover-verify.md). The map card (opens Explore), the readiness check
 * before Discover, the ten Discover tasks, suggested paths (each opens Verify), checked paths with their
 * band, and a follow-up readiness check later. Settings live in the Account tab. Everything is read from
 * and saved on the phone.
 */
export function DiscoverPage() {
  return <JourneyGate>{(data, reload) => <Island data={data} onChanged={reload} />}</JourneyGate>;
}

type Running = { kind: 'task'; n: number } | { kind: 'readiness'; phase: 'pre' | 'post' } | null;

function Island({ data, onChanged }: { data: JourneyData; onChanged: () => void }) {
  const jt = useJT();
  const nf = useNumberFormat();
  const plan = discoverPlan();
  const status = data.discover;
  const [running, setRunning] = useState<Running>(null);
  const [reward, setReward] = useState<Preview | null>(null);
  const [skippedBaseline, setSkippedBaseline] = useState(false);
  // Once Discover is finished, the ten tasks fold into one line.
  const [showTasks, setShowTasks] = useState(false);
  // Readiness answers are saved together at the end (the service needs all six at once).
  const collected = useRef<Record<string, number>>({});

  const hasPre = data.readiness.some((r) => r.phase === 'pre');
  const hasPost = data.readiness.some((r) => r.phase === 'post');
  const firstResultAt = Object.values(data.journey.paths)
    .map((p) => p.result?.at)
    .filter((x): x is string => Boolean(x))
    .sort()[0];
  // Read once per load (data changes on every reload), not on every render.
  const [now] = useState(() => Date.now());
  const offerBaseline = !hasPre && status.doneCount === 0 && data.open && !skippedBaseline;
  const offerFollowUp = !hasPost && Boolean(firstResultAt) && now - Date.parse(firstResultAt!) >= FOLLOW_UP_DAYS * DAY;

  if (running?.kind === 'readiness') {
    return (
      <TaskRunner
        title={jt(running.phase === 'pre' ? 'readiness.baselineTitle' : 'readiness.followTitle')}
        intro={jt(running.phase === 'pre' ? 'readiness.baselineIntro' : 'readiness.followIntro')}
        steps={readinessSteps()}
        art={['tasks/discover/readiness', ...discoverArt()]}
        initial={{}}
        onAnswer={async (step, value) => {
          collected.current[step.id] = value;
          return true;
        }}
        onDone={async () => {
          try {
            await data.rt.service.saveReadiness(data.rt.userId, {
              phase: running.phase,
              sessionId: data.sessionId,
              answers: collected.current,
            });
            void import('@/lib/local/research').then(({ syncResearch }) => syncResearch(data.rt));
          } finally {
            setRunning(null);
            onChanged();
          }
        }}
        onClose={() => setRunning(null)}
      />
    );
  }

  if (running?.kind === 'task') {
    const task = plan[running.n - 1]!;
    return (
      <TaskRunner
        title={`${jt('task', { n: nf.format(task.n) })} · ${jt(`taskTitles.${task.n}`)}`}
        steps={discoverSteps(task)}
        art={discoverArt(task.n)}
        initial={data.answers}
        onAnswer={async (step, value, ms) => {
          if (!data.open || !('instrumentId' in step)) return false;
          try {
            await data.rt.service.saveResponses(data.rt.userId, {
              sessionId: data.sessionId,
              station: step.instrumentId,
              responses: [{ itemId: step.id, value, ms }],
            });
            return true;
          } catch {
            return false;
          }
        }}
        onDone={async () => {
          setReward(
            await data.rt.service.preview(data.rt.userId, {
              sessionId: data.sessionId,
            }),
          );
          await maybeFinalize(data);
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
    <AppShell
      tab="home"
      leading={<LogoMark className="h-10" />}
      title={data.rt.profile.displayName ? jt('home.hello', { name: data.rt.profile.displayName }) : jt('title')}
      subtitle={jt('home.subtitle')}
      action={<AccountButton />}
      testId="discover"
    >
      <div className="flex flex-col gap-5">
        {!data.rt.device.persistent && <StorageWarning />}
        <InstallHint dismissible />

        <section className="overflow-hidden rounded-3xl bg-brand-lavender shadow-sm" data-testid="home-map">
          <JourneyMap data={data} />
          <div className="flex items-center gap-3 bg-card/90 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
              <MapIcon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{jt('home.mapTitle')}</p>
              <p className="text-xs text-muted-foreground">{jt(`explore.hint.${data.preview.flat ? 'none' : data.preview.stage}`)}</p>
            </div>
            <Button asChild size="sm" data-testid="open-map">
              <Link href="/journey/map">{jt('home.openMap')}</Link>
            </Button>
          </div>
        </section>

        {offerBaseline && (
          <section className="rounded-3xl border-2 border-brand-orange-soft bg-accent p-5" data-testid="baseline">
            <h2 className="font-semibold">{jt('readiness.baselineTitle')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{jt('readiness.baselineIntro')}</p>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={() => {
                  collected.current = {};
                  setRunning({ kind: 'readiness', phase: 'pre' });
                }}
                data-testid="baseline-start"
              >
                {jt('readiness.start')}
              </Button>
              <Button variant="ghost" onClick={() => setSkippedBaseline(true)}>
                {jt('readiness.skip')}
              </Button>
            </div>
          </section>
        )}

        {offerFollowUp && (
          <section className="rounded-3xl border-2 border-brand-orange-soft bg-accent p-5" data-testid="follow-up">
            <h2 className="font-semibold">{jt('readiness.followTitle')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{jt('readiness.followIntro')}</p>
            <Button
              className="mt-3"
              onClick={() => {
                collected.current = {};
                setRunning({ kind: 'readiness', phase: 'post' });
              }}
              data-testid="follow-up-start"
            >
              {jt('readiness.start')}
            </Button>
          </section>
        )}

        {data.preview.stage !== 'none' && <Suggestions preview={data.preview} results={bandsOf(data)} />}

        <section className="flex flex-col gap-3 rounded-3xl bg-card p-5 shadow-sm">
          <h2 className="text-lg font-bold">{jt('home.discoverTitle')}</h2>
          <p className="text-sm text-muted-foreground">{jt('intro')}</p>
          <ProgressBar value={status.doneCount} max={plan.length} label={jt('title')} />
          <p className="text-xs text-muted-foreground tabular-nums">
            {jt('progress', {
              done: nf.format(status.doneCount),
              total: nf.format(plan.length),
            })}
          </p>
          {status.next === null && (
            <button type="button" className="tap-link self-start" onClick={() => setShowTasks((v) => !v)} data-testid="toggle-tasks">
              {jt(showTasks ? 'hideTasks' : 'showTasks')}
            </button>
          )}
          <ol className={cn('flex flex-col gap-2', status.next === null && !showTasks && 'hidden')} data-testid="discover-tasks">
            {plan.map((task, i) => {
              const done = status.done[i]!;
              const next = status.next === task.n;
              const locked = !done && !next;
              const minutes = Math.max(1, Math.round((task.items.length * 8) / 60));
              return (
                <li key={task.n}>
                  <button
                    type="button"
                    disabled={locked || !data.open || offerBaseline}
                    onClick={() => setRunning({ kind: 'task', n: task.n })}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl border p-3 text-start transition-colors',
                      next ? 'border-primary bg-secondary shadow-sm' : done ? 'bg-card' : 'border-transparent bg-muted/50 opacity-70',
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
                        {jt('taskMeta', {
                          count: nf.format(task.items.length),
                          min: nf.format(minutes),
                        })}{' '}
                        · {jt(`state.${done ? 'done' : next ? 'next' : 'locked'}`)}
                      </span>
                    </span>
                    {next && !offerBaseline && <span className="rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground">{jt('start')}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        {data.hasResult && (
          <Button asChild variant="outline">
            <Link href="/assessment/result">{jt('myProfile')}</Link>
          </Button>
        )}
      </div>
    </AppShell>
  );
}

export function bandsOf(data: JourneyData): Record<string, VerifyBand> {
  return Object.fromEntries(Object.entries(data.journey.paths).flatMap(([id, p]) => (p.result ? [[id, p.result.band]] : [])));
}

function Suggestions({ preview, results = {} }: { preview: Preview; results?: Record<string, VerifyBand> }) {
  const jt = useJT();
  const tx = useText();
  const locale = useLocale();
  const list = new Intl.ListFormat(locale, {
    style: 'narrow',
    type: 'conjunction',
  });
  const early = preview.stage === 'early';
  const top = preview.groups.slice(0, 3);
  // Paths checked outside the top 3 are listed too.
  const extra = preview.groups.filter((g) => results[g.cluster] && !top.includes(g));
  return (
    <section
      className={cn('rounded-3xl border-2 p-5', early ? 'border-dashed border-brand-violet-soft/50 bg-card' : 'border-primary/40 bg-secondary')}
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
      {(!preview.flat || extra.length > 0) && (
        <ul className="mt-3 flex flex-col gap-2">
          {[...(preview.flat ? [] : top), ...extra].map((g) => {
            const name = clusters.find((c) => c.id === g.cluster)?.name;
            const band = results[g.cluster];
            const canVerify = !early && Boolean(pathById(g.cluster));
            const body = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{name ? tx(name) : g.cluster}</span>
                  <span className="block text-xs text-muted-foreground">
                    {jt('reward.top', {
                      list: list.format(
                        g.careerIds.slice(0, 2).map((id) => {
                          const c = careerById(id);
                          return c ? tx(c.name) : id;
                        }),
                      ),
                    })}
                  </span>
                  {band ? (
                    <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary" data-testid="path-band">
                      {jt(`verify.bands.${band}`)}
                    </span>
                  ) : !early && !canVerify ? (
                    <span className="mt-1 block text-xs font-medium text-muted-foreground">{jt('reward.verifySoon')}</span>
                  ) : null}
                </span>
                {canVerify && <ChevronRight className="size-5 shrink-0 text-primary rtl:rotate-180" aria-hidden="true" />}
              </>
            );
            return (
              <li key={g.cluster} data-testid="suggested-path" data-path={g.cluster}>
                {canVerify ? (
                  <Link href={`/journey/${g.cluster}`} className="flex items-center gap-2 rounded-2xl bg-card p-3 shadow-sm hover:shadow-md">
                    {body}
                  </Link>
                ) : (
                  <div className={cn('flex items-center gap-2 rounded-2xl bg-card p-3 shadow-sm', early && 'opacity-80')}>{body}</div>
                )}
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
        {jt('progress', {
          done: nf.format(done),
          total: nf.format(discoverPlan().length),
        })}
      </p>
      {preview.stage === 'none' ? <p className="rounded-xl bg-muted p-4 text-sm">{jt('reward.none')}</p> : <Suggestions preview={preview} />}
      <Button size="lg" onClick={onBack} data-testid="reward-back">
        {jt('back')}
      </Button>
    </main>
  );
}
