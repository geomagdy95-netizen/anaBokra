'use client';

import { careerById, clusters } from '@anabokra/content';
import { Check, ChevronRight, Lock, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { pathArt } from '@/features/art/task-art';
import { TaskArt } from '@/features/art/task-art-view';
import { useNumberFormat } from '@/features/assessment/primitives';
import { useText } from '@/features/assessment/ui-context';
import type { CareerPage } from '@/features/careers/types';
import { Link } from '@/i18n/navigation';
import {
  CAREER_CAP,
  CareerCapError,
  careerState,
  careerUnlocked,
  questBeatDone,
  questDone,
  questPlan,
  saveQuestAnswer,
  saveQuestResult,
  scoreQuest,
  setCareerSelected,
  taskId,
  type CareerResult,
  type QuestBeat,
} from '@/lib/journey/career-quest';
import type { JourneyData } from '@/lib/journey/journey';
import { readJourney, VERIFY_BANDS } from '@/lib/journey/verify';
import { cn } from '@/lib/utils';

import { AppShell } from './app-shell';
import { BAND_ICON, BAND_TONE, HeroCard, HeroPills, HeroText, PromptCard } from './cards';
import { JourneyGate } from './journey-gate';
import { Choices, Guide, Reactions, reactionText, Reply, chip } from './path-story';
import { useJT } from './use-jt';

/**
 * A career island (L2, docs/product/world-spec.md §2.3): opens once the career's group is checked.
 * An intro from the career's page, the career quest (a short chat built from that page, career-quest.ts),
 * then how the career fits, with "make it one of my careers" (at most CAREER_CAP).
 */
export function CareerIslandPage({ careerId, page }: { careerId: string; page: CareerPage }) {
  return <JourneyGate>{(data, reload) => <CareerIsland data={data} careerId={careerId} page={page} onChanged={reload} />}</JourneyGate>;
}

function CareerIsland({ data, careerId, page, onChanged }: { data: JourneyData; careerId: string; page: CareerPage; onChanged: () => void }) {
  const jt = useJT();
  const tx = useText();
  const nf = useNumberFormat();
  const career = careerById(careerId)!;
  const groupId = career.cluster;
  const groupName = tx(clusters.find((c) => c.id === groupId)?.name ?? { en: groupId, ar: groupId });
  const name = tx(career.name);
  const rec = data.journey.careers?.[careerId];
  const beats = questPlan(page);
  const [running, setRunning] = useState(false);
  const [showResult, setShowResult] = useState(Boolean(rec?.result));
  const [failed, setFailed] = useState(false);

  const frame = (testId: string, children: ReactNode, subtitle = groupName) => (
    <AppShell tab="explore" back={`/journey/${groupId}`} title={name} subtitle={subtitle} testId={testId}>
      <div className="flex flex-col gap-5">{children}</div>
    </AppShell>
  );

  if (!careerUnlocked(data.journey, careerId))
    return frame(
      'career-locked',
      <>
        <p className="flex gap-2 rounded-2xl bg-secondary p-4 text-sm">
          <Lock className="size-4 shrink-0 text-primary" aria-hidden />
          {jt('career.locked', { group: groupName })}
        </p>
        <Button asChild size="lg">
          <Link href={`/journey/${groupId}`}>{jt('career.checkGroup', { group: groupName })}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/careers/${careerId}`}>{jt('career.readPage')}</Link>
        </Button>
      </>,
    );

  /** Scores the quest from the saved answers and shows the result. */
  const finish = async () => {
    setRunning(false);
    setFailed(false);
    try {
      const fresh = (await readJourney(data.rt.device.kv, data.rt.userId)).careers?.[careerId]?.answers ?? {};
      if (questDone(page, fresh)) {
        await saveQuestResult(data.rt.device.kv, data.rt.userId, scoreQuest(page, fresh, { profileFit: data.preview.fits[careerId] ?? 0 }));
        setShowResult(true);
      }
    } catch {
      setFailed(true);
    } finally {
      onChanged();
    }
  };

  if (running)
    return (
      <QuestChat
        title={jt('career.questTitle', { career: name })}
        art={pathArt(groupId)}
        careerName={name}
        beats={beats}
        initial={rec?.answers ?? {}}
        onAnswer={async (id, value) => {
          try {
            await saveQuestAnswer(data.rt.device.kv, data.rt.userId, careerId, id, value);
            return true;
          } catch {
            return false;
          }
        }}
        onDone={() => void finish()}
        onClose={() => {
          setRunning(false);
          onChanged();
        }}
      />
    );

  if (showResult && rec?.result)
    return frame(
      'career-result',
      <CareerResultView
        data={data}
        page={page}
        result={rec.result}
        name={name}
        groupId={groupId}
        onAgain={() => {
          setShowResult(false);
          setRunning(true);
        }}
        onChanged={onChanged}
      />,
      jt('career.resultEyebrow'),
    );

  const answered = beats.filter((b) => questBeatDone(b, rec?.answers ?? {})).length;
  const state = careerState(data.journey, careerId);
  return frame(
    'career-island',
    <HeroCard art={<TaskArt chain={pathArt(groupId)} className="absolute inset-0" />} eyebrow={jt('career.questTitle', { career: name })} title={page.snapshot?.hook ? tx(page.snapshot.hook) : name}>
        {page.snapshot?.summary && <HeroText>{tx(page.snapshot.summary)}</HeroText>}
        <HeroPills items={[`⏱️ ${jt('day.minutes', { min: nf.format(2) })}`, `🎯 ${jt('career.steps', { count: nf.format(beats.length) })}`, `✨ ${jt('day.noWrong')}`]} />
        {answered > 0 && answered < beats.length && (
          <p className="text-xs text-muted-foreground tabular-nums">{jt('day.progress', { done: nf.format(answered), total: nf.format(beats.length) })}</p>
        )}
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {jt('verify.resultFailed')}
          </p>
        )}
        {answered === beats.length && !rec?.result ? (
          <Button size="lg" className="h-14 rounded-2xl text-base" onClick={() => void finish()} data-testid="career-result-btn">
            {jt('verify.result')}
          </Button>
        ) : (
          <Button size="lg" className="h-14 rounded-2xl text-base" onClick={() => setRunning(true)} data-testid="career-start">
            {jt(answered > 0 && answered < beats.length ? 'career.continue' : 'career.start')}
          </Button>
        )}
        {rec?.result && (
          <Button variant="outline" onClick={() => setShowResult(true)} data-testid="career-last-result">
            {jt('day.lastResult')}
          </Button>
        )}
        {state === 'selected' && <p className="text-sm font-semibold text-primary">✓ {jt('career.isMine')}</p>}
        <Link href={`/careers/${careerId}`} className="tap-link self-start text-sm">
          {jt('career.readPage')}
        </Link>
    </HeroCard>,
  );
}

// --- The quest chat -------------------------------------------------------------------------------

interface QuestChatProps {
  title: string;
  art: string[];
  careerName: string;
  beats: QuestBeat[];
  initial: Record<string, number>;
  onAnswer: (id: string, value: number) => Promise<boolean>;
  onDone: () => void;
  onClose: () => void;
}

/** The career quest as a chat, like the path story: one beat at a time, answered inline. */
export function QuestChat({ title, art, careerName, beats, initial, onAnswer, onDone, onClose }: QuestChatProps) {
  const jt = useJT();
  const nf = useNumberFormat();
  // A quest answered all the way through is played again from the start ("answer again").
  const [answers, setAnswers] = useState<Record<string, number>>(() => (beats.every((b) => questBeatDone(b, initial)) ? {} : initial));
  const [current, setCurrent] = useState(() => Math.max(0, beats.findIndex((b) => !questBeatDone(b, answers))));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [current, answers]);

  const beat = beats[current]!;
  const answered = beats.filter((b) => questBeatDone(b, answers)).length;

  const save = async (values: Record<string, number>) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    for (const [id, v] of Object.entries(values)) {
      if (!(await onAnswer(id, v))) {
        setBusy(false);
        setFailed(true);
        return;
      }
    }
    const next = { ...answers, ...values };
    setAnswers(next);
    if (questBeatDone(beat, next)) {
      // Knowledge beats show their reveal for a moment longer.
      await new Promise((r) => setTimeout(r, beat.kind === 'salary' || beat.kind === 'myth' ? 1400 : 450));
      if (current === beats.length - 1) {
        setBusy(false);
        onDone();
        return;
      }
      setCurrent(current + 1);
    }
    setBusy(false);
  };

  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col bg-background" data-testid="career-quest">
      <div className="relative h-32 shrink-0 overflow-hidden">
        <TaskArt chain={art} className="absolute inset-0" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40" />
        <div className="absolute inset-x-0 top-0 flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <span className="min-w-0 flex-1 truncate rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-brand-ink shadow-sm backdrop-blur">{title}</span>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={jt('back')} className="shrink-0 rounded-full bg-white/90 text-brand-ink shadow-sm hover:bg-white">
            <X className="size-5" />
          </Button>
        </div>
        <div className="absolute inset-x-4 bottom-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/50" aria-hidden="true">
            <div className="h-full rounded-full bg-brand-orange transition-[width] duration-500" style={{ width: `${(answered / beats.length) * 100}%` }} />
          </div>
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold tabular-nums text-brand-ink" data-testid="quest-progress">
            {jt('day.progress', { done: nf.format(answered), total: nf.format(beats.length) })}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-6 pt-4" aria-live="polite">
        {beats.slice(0, current + 1).map((b, i) => (
          <QuestBeatView key={b.id} beat={b} careerName={careerName} answers={answers} active={i === current} busy={busy} onAnswer={(v) => void save(v)} />
        ))}
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {jt('saveFailed')}
          </p>
        )}
        <div ref={end} />
      </div>
    </main>
  );
}

function QuestBeatView({
  beat,
  careerName,
  answers,
  active,
  busy,
  onAnswer,
}: {
  beat: QuestBeat;
  careerName: string;
  answers: Record<string, number>;
  active: boolean;
  busy: boolean;
  onAnswer: (values: Record<string, number>) => void;
}) {
  const jt = useJT();
  const tx = useText();
  const nf = useNumberFormat();
  const value = answers[beat.id];
  const one = (v: number) => onAnswer({ [beat.id]: v });

  switch (beat.kind) {
    case 'day':
      return (
        <>
          <Guide lead={jt('career.lead.day', { career: careerName })}>{tx(beat.text)}</Guide>
          {value !== undefined ? <Reply>{reactionText(jt, 'story', value)}</Reply> : active && <Reactions keys="story" disabled={busy} onPick={one} />}
        </>
      );
    case 'tasks':
      return <TasksBeat beat={beat} answers={answers} active={active} busy={busy} onAnswer={onAnswer} />;
    case 'salary': {
      const range = (o: { min: number; max: number }) => jt('career.range', { min: nf.format(o.min), max: nf.format(o.max) });
      return (
        <>
          <Guide lead={jt('career.lead.salary')}>{jt('career.salaryQ', { career: careerName })}</Guide>
          {value === undefined ? (
            active && (
              <Choices className="flex-col items-end">
                {beat.options.map((o, i) => (
                  <button key={i} type="button" className={chip} disabled={busy} onClick={() => one(i)} data-testid={`salary-${i}`}>
                    {range(o)}
                  </button>
                ))}
              </Choices>
            )
          ) : (
            <>
              <Reply>{range(beat.options[value]!)}</Reply>
              <Guide lead={value === beat.answer ? jt('puzzle.right') : jt('career.close')}>
                {jt('career.salaryReveal', { range: range(beat.options[beat.answer]!) })}
                <span className="mt-1 block text-xs text-muted-foreground">{jt('career.salaryNote')}</span>
              </Guide>
            </>
          )}
        </>
      );
    }
    case 'challenge':
      return (
        <>
          <Guide lead={jt('career.lead.challenge')}>{tx(beat.text)}</Guide>
          {value !== undefined ? <Reply>{reactionText(jt, 'career.live', value)}</Reply> : active && <Reactions keys="career.live" disabled={busy} onPick={one} />}
        </>
      );
    case 'myth': {
      const picked = value === undefined ? undefined : value === 0 ? 'myth' : 'fact';
      const right = picked !== undefined && (picked === 'myth') === beat.isMyth;
      return (
        <>
          <Guide lead={jt('career.lead.myth')}>«{tx(beat.statement)}»</Guide>
          {value === undefined ? (
            active && (
              <Choices className="flex-nowrap">
                <button type="button" className={cn(chip, 'flex-1 basis-0 rounded-2xl text-center')} disabled={busy} onClick={() => one(0)} data-testid="myth-0">
                  🙅 {jt('career.myth')}
                </button>
                <button type="button" className={cn(chip, 'flex-1 basis-0 rounded-2xl text-center')} disabled={busy} onClick={() => one(1)} data-testid="myth-1">
                  ✅ {jt('career.fact')}
                </button>
              </Choices>
            )
          ) : (
            <>
              <Reply>{picked === 'myth' ? `🙅 ${jt('career.myth')}` : `✅ ${jt('career.fact')}`}</Reply>
              <Guide lead={right ? jt('puzzle.right') : jt('career.notQuite')}>
                {beat.isMyth ? jt('career.isMyth', { fact: tx(beat.explain) }) : jt('career.isFact', { myth: tx(beat.explain) })}
              </Guide>
            </>
          )}
        </>
      );
    }
    case 'route':
      return (
        <>
          <Guide lead={jt('career.lead.route')}>
            <ul className="list-disc space-y-1 ps-5">
              {beat.faculties.map((f, i) => (
                <li key={i}>{tx(f)}</li>
              ))}
            </ul>
            {beat.years ? <p className="mt-1 text-sm font-semibold">{jt('career.years', { n: nf.format(beat.years) })}</p> : null}
            <p className="mt-2 font-semibold">{jt('career.routeQ')}</p>
          </Guide>
          {value !== undefined ? <Reply>{reactionText(jt, 'career.route', value)}</Reply> : active && <Reactions keys="career.route" disabled={busy} onPick={one} />}
        </>
      );
  }
}

/** "Tap the tasks you'd enjoy": the career's tasks as toggles in the chat, saved together. */
function TasksBeat({ beat, answers, active, busy, onAnswer }: { beat: Extract<QuestBeat, { kind: 'tasks' }>; answers: Record<string, number>; active: boolean; busy: boolean; onAnswer: (values: Record<string, number>) => void }) {
  const jt = useJT();
  const tx = useText();
  const nf = useNumberFormat();
  const done = beat.tasks.every((_, i) => answers[taskId(i)] !== undefined);
  const [on, setOn] = useState(() => new Set(beat.tasks.flatMap((_, i) => (answers[taskId(i)] ? [i] : []))));
  const toggle = (i: number) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  return (
    <>
      <Guide lead={jt('career.lead.tasks')}>{jt('career.tasksQ')}</Guide>
      {done ? (
        <Reply>{jt('career.tasksPicked', { n: nf.format(beat.tasks.filter((_, i) => answers[taskId(i)]).length), total: nf.format(beat.tasks.length) })}</Reply>
      ) : (
        active && (
          <div className="flex flex-col gap-2 ps-10" data-testid="quest-tasks">
            {beat.tasks.map((t, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={on.has(i)}
                onClick={() => toggle(i)}
                className={cn(
                  'flex items-start gap-2 rounded-2xl border-2 px-3 py-2.5 text-start text-sm font-medium transition-colors',
                  on.has(i) ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/30 bg-card hover:border-primary',
                )}
              >
                <span aria-hidden="true" className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2', on.has(i) ? 'border-current bg-primary-foreground text-primary' : 'border-foreground/30')}>
                  {on.has(i) && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                {tx(t)}
              </button>
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={() => onAnswer(Object.fromEntries(beat.tasks.map((_, i) => [taskId(i), on.has(i) ? 1 : 0])))}
              className="h-12 rounded-2xl bg-primary font-semibold text-primary-foreground shadow-sm disabled:opacity-60"
              data-testid="quest-tasks-done"
            >
              {on.size ? jt('grid.done', { count: nf.format(on.size) }) : jt('grid.none')}
            </button>
          </div>
        )
      )}
    </>
  );
}

// --- The result -----------------------------------------------------------------------------------

const levelOf = (x: number): 1 | 2 | 3 => (x >= VERIFY_BANDS.fitsWell ? 3 : x >= VERIFY_BANDS.fitsPartly ? 2 : 1);

export function CareerResultView({
  data,
  page,
  result,
  name,
  groupId,
  onAgain,
  onChanged,
}: {
  data: JourneyData;
  page: CareerPage;
  result: CareerResult;
  name: string;
  groupId: string;
  onAgain: () => void;
  onChanged: () => void;
}) {
  const jt = useJT();
  const tx = useText();
  const selected = data.journey.selectedCareers ?? [];
  const isMine = selected.includes(result.careerId);
  const [cap, setCap] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const careerName = (id: string) => {
    const c = careerById(id);
    return c ? tx(c.name) : id;
  };

  const choose = async (id: string, on: boolean) => {
    setBusy(true);
    try {
      await setCareerSelected(data.rt.device.kv, data.rt.userId, id, on);
      setCap(null);
      onChanged();
    } catch (e) {
      if (e instanceof CareerCapError) setCap(e.selected);
    } finally {
      setBusy(false);
    }
  };

  const tasks = page.whatYouDo?.tasks ?? [];
  const challenges = page.reality?.challenges ?? [];
  const signals = (['profile', 'activities', 'realities'] as const).map((k) => ({ key: k, level: levelOf(result.components[k]) }));

  return (
    <>
      <HeroCard tone={BAND_TONE[result.band]} icon={BAND_ICON[result.band]} title={jt(`career.bands.${result.band}`)} titleTestId="career-band">
        <HeroText>{jt(`career.bandText.${result.band}`, { career: name })}</HeroText>
        <ul className="flex flex-col gap-2">
          {signals.map(({ key, level }) => (
            <li key={key} className="flex items-center gap-3 rounded-2xl bg-card/80 px-3 py-2.5" data-signal={key} data-level={level}>
              <span aria-hidden="true" className="text-xl">
                {key === 'profile' ? '🏝️' : key === 'activities' ? '😍' : '⚖️'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{jt(`career.signal.${key}`)}</span>
                <span className="block text-xs text-muted-foreground">{jt(key === 'profile' ? `career.profileLevel.${level}` : `verify.signal.${key}.${level}`)}</span>
              </span>
              <span className="flex shrink-0 gap-1" aria-hidden="true">
                {[1, 2, 3].map((d) => (
                  <span key={d} className={cn('size-2.5 rounded-full', d <= level ? 'bg-primary' : 'bg-primary/15')} />
                ))}
              </span>
            </li>
          ))}
        </ul>
      </HeroCard>

      <PromptCard tone="lavender" icon={isMine ? '⭐' : '🏝️'} title={isMine ? jt('career.isMine') : cap ? jt('career.capReached', { n: CAREER_CAP }) : jt('career.chooseQ', { career: name })} testId="career-choose">
        {isMine ? (
          <>
            <p className="text-sm text-muted-foreground">{jt('career.nextLevel')}</p>
            <div className="flex items-center gap-3 rounded-2xl bg-card/70 p-3 text-sm text-muted-foreground">
              <Lock className="size-4 shrink-0" aria-hidden />
              {jt('career.planSoon')}
            </div>
            <button type="button" className="tap-link self-start text-sm" disabled={busy} onClick={() => void choose(result.careerId, false)} data-testid="career-unselect">
              {jt('career.letGo')}
            </button>
          </>
        ) : cap ? (
          <>
            <p className="text-sm text-muted-foreground">{jt('career.capHint')}</p>
            <div className="flex flex-col gap-2">
              {cap.map((id) => (
                <Button key={id} variant="outline" className="justify-between rounded-2xl bg-card" disabled={busy} onClick={() => void choose(id, false).then(() => choose(result.careerId, true))}>
                  {jt('career.swap', { old: careerName(id), new: name })}
                  <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
                </Button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{jt('career.chooseHint', { n: CAREER_CAP })}</p>
            <Button size="lg" className="h-12 w-full rounded-2xl" disabled={busy} onClick={() => void choose(result.careerId, true)} data-testid="career-select">
              {jt('career.choose')}
            </Button>
          </>
        )}
      </PromptCard>

      {result.likedTasks.length > 0 && (
        <section>
          <h3 className="text-base font-bold">{jt('career.liked')}</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {result.likedTasks.slice(0, 4).map((i) => (
              <li key={i} className="flex gap-2 rounded-2xl bg-primary/5 p-3 text-sm">
                <span aria-hidden="true">😍</span>
                {tasks[i] ? tx(tasks[i]!) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.hardFor.length > 0 && (
        <section>
          <h3 className="text-base font-bold">{jt('verify.keep')}</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {result.hardFor.map((i) => (
              <li key={i} className="rounded-2xl bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
                ⚠️ {challenges[i] ? tx(challenges[i]!) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-2">
        <Button asChild size="lg" variant="outline" className="h-12 justify-between rounded-2xl">
          <Link href={`/careers/${result.careerId}`}>
            {jt('career.readPage')}
            <ChevronRight className="size-5 rtl:rotate-180" aria-hidden />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12 justify-between rounded-2xl">
          <Link href={`/journey/${groupId}`}>
            {jt('career.backToGroup')}
            <ChevronRight className="size-5 rtl:rotate-180" aria-hidden />
          </Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{jt('verify.disclaimer')}</p>
      <button type="button" className="tap-link self-start text-sm" onClick={onAgain} data-testid="career-again">
        {jt('verify.again')}
      </button>
    </>
  );
}
