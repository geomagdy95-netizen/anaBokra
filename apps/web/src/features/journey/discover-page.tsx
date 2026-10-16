'use client';

import { careerById, clusters, pathById } from '@anabokra/content';
import { Check, ChevronRight, Lock } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { GamesSummary } from '@/features/games/game-summary-card';
import { useGT } from '@/features/games/use-gt';
import type { GameNorms } from '@/features/games/score';
import { ProgressBar, useNumberFormat } from '@/features/assessment/primitives';
import { useText } from '@/features/assessment/ui-context';
import { StorageWarning } from '@/features/local/local-states';
import { InstallHint } from '@/features/pwa/install-hint';
import { Link, useRouter } from '@/i18n/navigation';
import { CAREER_CAP } from '@/lib/journey/career-quest';
import { discoverPlan } from '@/lib/journey/discover-plan';
import { cachedNorms, comparisonBand, gameStepId, playedGameSteps, refreshNorms, saveGame } from '@/lib/journey/games';
import { FOLLOW_UP_DAYS, gameStandingsFor, maybeFinalize, type JourneyData } from '@/lib/journey/journey';
import { readJourney, type VerifyBand } from '@/lib/journey/verify';
import { cn } from '@/lib/utils';
import type { Preview } from '@/server/assessment/scoring';

import { AppShell } from './app-shell';
import { HeroCard, HeroPills, PromptCard } from './cards';
import { InterestCompass } from './interest-compass';
import { JourneyGate } from './journey-gate';
import { discoverSteps, readinessSteps } from './steps';
import { TaskRunner } from './task-runner';
import { discoverArt } from '@/features/art/task-art';
import { useJT } from './use-jt';

const DAY = 86_400_000;

/**
 * My island's full page (docs/product/discover-verify.md), opened from its sheet or a station on the map:
 * the readiness check before Discover, the ten Discover tasks (`?task=n` opens one straight away),
 * suggested paths (each opens Verify), checked paths with their band, my careers, and a follow-up
 * readiness check later. Everything is read from and saved on the phone.
 */
export function DiscoverPage() {
  return <JourneyGate>{(data, reload) => <Island data={data} onChanged={reload} />}</JourneyGate>;
}

/** What runs full screen; a readiness check can lead straight into a task (`then`). */
type Running = { kind: 'task'; n: number } | { kind: 'readiness'; phase: 'pre' | 'post'; then?: number } | null;

function Island({ data, onChanged }: { data: JourneyData; onChanged: () => void }) {
  const jt = useJT();
  const gt = useGT();
  const nf = useNumberFormat();
  const plan = discoverPlan();
  const status = data.discover;
  const played = new Set(playedGameSteps(data.journey));
  const params = useSearchParams();
  const router = useRouter();
  const hasPreAtLoad = data.readiness.some((r) => r.phase === 'pre');
  // A station tapped on the map (?task=n) opens straight away when it can be played now: the next task,
  // a bonus one, or a game left after the result. The readiness check comes first when it is still due.
  const [running, setRunning] = useState<Running>(() => {
    const n = Number(params.get('task'));
    const i = n - 1;
    if (!Number.isInteger(n) || !plan[i]) return null;
    const baselineDue = !hasPreAtLoad && status.doneCount === 0 && data.open;
    const task = plan[i]!;
    const gameLeft = Boolean(task.game && !played.has(gameStepId(task.game)));
    // A first-timer tapping "start here" goes through the readiness check and straight on into the task.
    if (baselineDue && status.next === n) return { kind: 'readiness', phase: 'pre', then: n };
    const playable = data.open ? !baselineDue && (status.next === n || (status.optional[i]! && !status.done[i]!)) : gameLeft;
    return playable ? { kind: 'task', n } : null;
  });
  // Drop ?task= so closing the task (or reloading) shows the island, not the task again.
  useEffect(() => {
    if (params.get('task')) router.replace('/journey/me');
  }, [params, router]);
  const [reward, setReward] = useState<{ preview: Preview; before: Record<string, number>; after: Record<string, number> } | null>(null);
  const [skippedBaseline, setSkippedBaseline] = useState(false);
  // Once Discover is finished, the ten tasks fold into one line.
  const [showTasks, setShowTasks] = useState(false);
  // Readiness answers are saved together at the end (the service needs all six at once).
  const collected = useRef<Record<string, number>>({});
  // The comparison with other players: the copy on the phone, refreshed in the background.
  const [norms, setNorms] = useState<GameNorms | null>(null);
  useEffect(() => {
    let alive = true;
    void cachedNorms(data.rt.device.kv).then((n) => alive && n && setNorms(n));
    void refreshNorms(data.rt.device.kv).then((n) => alive && n && setNorms(n));
    return () => {
      alive = false;
    };
  }, [data.rt]);

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
  const checkedCount = Object.values(data.journey.paths).filter((p) => p.result).length;
  const triedCount = Object.values(data.journey.careers ?? {}).filter((c) => c.result).length;

  if (running?.kind === 'readiness') {
    return (
      <TaskRunner
        key={`readiness-${running.phase}`}
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
            setRunning(running.then ? { kind: 'task', n: running.then } : null);
            onChanged();
          }
        }}
        onClose={() => {
          // Closing the check skips it for now; a task that was waiting on it starts anyway.
          if (running.phase === 'pre') setSkippedBaseline(true);
          setRunning(running.then ? { kind: 'task', n: running.then } : null);
        }}
      />
    );
  }

  if (running?.kind === 'task') {
    const task = plan[running.n - 1]!;
    return (
      <TaskRunner
        key={`task-${task.n}`}
        title={`${jt('task', { n: nf.format(task.n) })} · ${jt(`taskTitles.${task.n}`)}`}
        steps={discoverSteps(task, data.formats.interests)}
        art={discoverArt(task.n)}
        initial={{ ...data.answers, ...Object.fromEntries(playedGameSteps(data.journey).map((id) => [id, 1])) }}
        gameHost={{
          norms,
          ageBand: comparisonBand(data.rt.profile.ageBand),
          save: async (game, record) => {
            try {
              await saveGame(data.rt.device.kv, data.rt.userId, game, record);
              return true;
            } catch {
              return false;
            }
          },
        }}
        onAnswer={async (step, value, ms) => {
          // A game is kept by the game step itself (first full play); answering just moves on.
          if (step.kind === 'game') return true;
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
          const games = await gameStandingsFor(data.rt, await readJourney(data.rt.device.kv, data.rt.userId));
          const [preview, resume] = await Promise.all([
            data.rt.service.preview(data.rt.userId, {
              sessionId: data.sessionId,
              ...(games ? { games } : {}),
            }),
            data.rt.service.getResume(data.rt.userId, { sessionId: data.sessionId }),
          ]);
          // The compass on the reward grows from the answers before this task to the ones after it.
          setReward({ preview, before: data.answers, after: Object.fromEntries(resume.responses.map((r) => [r.itemId, r.value])) });
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

  if (reward)
    return (
      <Reward
        preview={reward.preview}
        done={status.doneCount}
        total={status.required}
        checklist={data.formats.interests === 'checklist'}
        compass={<InterestCompass answers={reward.after} before={reward.before} />}
        onBack={() => setReward(null)}
      />
    );

  return (
    <AppShell tab="home" title={jt('title')} testId="discover">
      <div className="flex flex-col gap-5">
        <HeroCard eyebrow={jt('home.subtitle')} title={data.rt.profile.displayName ? jt('home.hello', { name: data.rt.profile.displayName }) : jt('home.welcome')} testId="island-hero">
          <HeroPills
            items={[
              jt('progress', { done: nf.format(status.doneCount), total: nf.format(status.required) }),
              checkedCount > 0 && jt('results.stats.fields', { count: checkedCount }),
              triedCount > 0 && jt('results.stats.careers', { count: triedCount }),
            ]}
          />
        </HeroCard>
        {!data.rt.device.persistent && <StorageWarning />}
        <InstallHint dismissible />

        {offerBaseline && (
          <PromptCard icon="🧭" title={jt('readiness.baselineTitle')} body={jt('readiness.baselineIntro')} testId="baseline">
            <div className="flex gap-2">
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
          </PromptCard>
        )}

        {offerFollowUp && (
          <PromptCard
            icon="🌱"
            title={jt('readiness.followTitle')}
            body={jt('readiness.followIntro')}
            action={
              <Button
                size="sm"
                onClick={() => {
                  collected.current = {};
                  setRunning({ kind: 'readiness', phase: 'post' });
                }}
                data-testid="follow-up-start"
              >
                {jt('readiness.start')}
              </Button>
            }
            testId="follow-up"
          />
        )}

        {data.preview.stage !== 'none' && <Suggestions preview={data.preview} results={bandsOf(data)} checklist={data.formats.interests === 'checklist'} />}

        {status.next !== null && <InterestCompass answers={data.answers} compact />}

        <section className="flex flex-col gap-3 rounded-3xl bg-card p-5 shadow-sm">
          <h2 className="text-lg font-bold">{jt('home.discoverTitle')}</h2>
          <p className="text-sm text-muted-foreground">{jt('intro')}</p>
          <ProgressBar value={status.doneCount} max={status.required} label={jt('title')} />
          <p className="text-xs text-muted-foreground tabular-nums">
            {jt('progress', {
              done: nf.format(status.doneCount),
              total: nf.format(status.required),
            })}
          </p>
          {status.optional.some(Boolean) && status.next === null && (
            <p className="rounded-2xl bg-secondary p-3 text-sm" data-testid="discover-settled">
              {jt('settled')}
            </p>
          )}
          {status.next === null && (
            <button type="button" className="tap-link self-start" onClick={() => setShowTasks((v) => !v)} data-testid="toggle-tasks">
              {jt(showTasks ? 'hideTasks' : 'showTasks')}
            </button>
          )}
          <ol className={cn('flex flex-col gap-2', status.next === null && !showTasks && 'hidden')} data-testid="discover-tasks">
            {plan.map((task, i) => {
              const done = status.done[i]!;
              // Tasks 9–10 once the top interests are settled: a bonus, open any time.
              const bonus = status.optional[i]! && !done;
              const next = status.next === task.n;
              const locked = !done && !next && !bonus;
              // After the result, a game not played yet can still be played (it no longer changes the result).
              const gameLeft = Boolean(task.game && !played.has(gameStepId(task.game)));
              const extraGame = !data.open && gameLeft;
              // About 8 seconds a question (3 for a card in the grid), plus about 2 minutes for a game.
              const seconds = task.items.reduce((n, it) => n + (it.instrumentId === 'interests' && data.formats.interests === 'checklist' ? 3 : 8), 0);
              const minutes = Math.max(1, Math.round(seconds / 60)) + (task.game ? 2 : 0);
              return (
                <li key={task.n}>
                  <button
                    type="button"
                    disabled={extraGame ? false : locked || !data.open || offerBaseline}
                    onClick={() => setRunning({ kind: 'task', n: task.n })}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl border p-3 text-start transition-colors',
                      next ? 'border-primary bg-secondary shadow-sm' : done ? 'bg-card' : 'border-transparent bg-muted/50 opacity-70',
                    )}
                    data-testid={`task-${task.n}`}
                    data-state={done ? 'done' : next ? 'next' : bonus ? 'bonus' : 'locked'}
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
                        {jt('taskMeta', { count: task.items.length, min: minutes })}{' '}
                        {task.game ? ` · ${jt('withGame', { name: gt(`${task.game}.title`) })}` : ''} · {jt(`state.${done ? 'done' : next ? 'next' : bonus ? 'bonus' : 'locked'}`)}
                      </span>
                    </span>
                    {next && !offerBaseline && <span className="rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground">{jt('start')}</span>}
                    {extraGame && <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">{jt('playGame')}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <MyCareers data={data} />

        {data.journey.games && Object.keys(data.journey.games).length > 0 && (
          <GamesSummary records={data.journey.games} norms={norms} ageBand={comparisonBand(data.rt.profile.ageBand)} />
        )}

        {data.hasResult && (
          <Button asChild variant="outline">
            <Link href="/assessment/result">{jt('myProfile')}</Link>
          </Button>
        )}
      </div>
    </AppShell>
  );
}

/**
 * "My careers" (L2): the careers the user selected (at most CAREER_CAP), each opening its island, and
 * the next level still fogged. Before any is selected, careers with a finished quest invite a choice.
 */
function MyCareers({ data }: { data: JourneyData }) {
  const jt = useJT();
  const tx = useText();
  const selected = data.journey.selectedCareers ?? [];
  const reached = Object.entries(data.journey.careers ?? {}).filter(([id, r]) => r.result && !selected.includes(id)).map(([id]) => id);
  if (!selected.length && !reached.length) return null;
  const row = (id: string, mine: boolean) => {
    const c = careerById(id);
    if (!c) return null;
    return (
      <li key={id}>
        <Link href={`/journey/${c.cluster}/${id}`} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm hover:shadow-md" data-testid={mine ? 'my-career' : 'reached-career'}>
          <span aria-hidden="true" className="text-xl">
            {mine ? '⭐' : '✓'}
          </span>
          <span className="min-w-0 flex-1 font-semibold">{tx(c.name)}</span>
          <ChevronRight className="size-5 shrink-0 text-primary rtl:rotate-180" aria-hidden="true" />
        </Link>
      </li>
    );
  };
  return (
    <section id="my-careers" className="flex scroll-mt-20 flex-col gap-3 rounded-3xl border-2 border-brand-orange-soft/60 bg-accent p-5" data-testid="my-careers">
      <h2 className="text-lg font-bold">{jt('myCareers.title')}</h2>
      {selected.length ? (
        <>
          <ul className="flex flex-col gap-2">{selected.map((id) => row(id, true))}</ul>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4 shrink-0" aria-hidden />
            {jt('career.planSoon')}
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{jt('myCareers.pick', { n: CAREER_CAP })}</p>
          <ul className="flex flex-col gap-2">{reached.map((id) => row(id, false))}</ul>
        </>
      )}
    </section>
  );
}

export function bandsOf(data: JourneyData): Record<string, VerifyBand> {
  return Object.fromEntries(Object.entries(data.journey.paths).flatMap(([id, p]) => (p.result ? [[id, p.result.band]] : [])));
}

function Suggestions({ preview, results = {}, checklist = false }: { preview: Preview; results?: Record<string, VerifyBand>; checklist?: boolean }) {
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
          {jt(checklist ? 'reward.flatChecklist' : 'reward.flat')}
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

function Reward({
  preview,
  done,
  total,
  checklist,
  compass,
  onBack,
}: {
  preview: Preview;
  done: number;
  total: number;
  checklist: boolean;
  compass: ReactNode;
  onBack: () => void;
}) {
  const jt = useJT();
  const nf = useNumberFormat();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-8" data-testid="reward">
      <HeroCard
        tone="success"
        titleAs="h1"
        icon={<span className="inline-block motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-500">🏝️</span>}
        title={jt('reward.title')}
      >
        <HeroPills items={[jt('progress', { done: nf.format(done), total: nf.format(total) })]} />
      </HeroCard>
      {compass}
      {preview.stage === 'none' ? <p className="rounded-xl bg-muted p-4 text-sm">{jt('reward.none')}</p> : <Suggestions preview={preview} checklist={checklist} />}
      <Button size="lg" onClick={onBack} data-testid="reward-back">
        {jt('back')}
      </Button>
    </main>
  );
}
