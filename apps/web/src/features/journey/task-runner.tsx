'use client';

import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { ArtChain } from '@/features/art/task-art';
import { TaskArt } from '@/features/art/task-art-view';
import { useNumberFormat } from '@/features/assessment/primitives';
import { useText } from '@/features/assessment/ui-context';
import { cn } from '@/lib/utils';

import { ChoiceQuestion, EnjoyQuestion, FacesQuestion, PuzzleQuestion, ScenarioQuestion, SliderQuestion, StoryQuestion, SwipeQuestion } from './questions';
import type { Step } from './steps';
import { useJT } from './use-jt';

export interface TaskRunnerProps {
  title: string;
  intro?: string;
  steps: Step[];
  /** The task's picture (cover screen, and steps without their own). */
  art?: ArtChain;
  /** Answers given before (the task resumes at the first unanswered step). */
  initial: Record<string, number>;
  /** Saves one answer. Return false if it couldn't be saved; the step stays on screen. */
  onAnswer: (step: Step, value: number, ms: number) => Promise<boolean>;
  onDone: () => void;
  onClose: () => void;
}

/**
 * Plays one task, one question at a time, as illustrated cards: a picture on top with the step dots,
 * the question below (docs/art/README.md). A task with an intro opens on a cover. Most answers move
 * on by themselves; a puzzle waits on its reveal until "Next". Every answer is saved as it is given,
 * so leaving midway loses nothing.
 */
export function TaskRunner({ title, intro, steps, art, initial, onAnswer, onDone, onClose }: TaskRunnerProps) {
  const jt = useJT();
  const tx = useText();
  const nf = useNumberFormat();
  const [answers, setAnswers] = useState<Record<string, number>>(initial);
  const [index, setIndex] = useState(() => {
    const i = steps.findIndex((s) => initial[s.id] === undefined);
    return i === -1 ? 0 : i;
  });
  const [started, setStarted] = useState(() => !intro || steps.some((s) => initial[s.id] !== undefined));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = Date.now();
  }, [index, started]);

  const step = steps[index]!;
  const value = answers[step.id];
  const last = index === steps.length - 1;

  const advance = () => (last ? onDone() : setIndex(index + 1));

  const answer = async (v: number) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await onAnswer(step, v, Math.max(0, Date.now() - shownAt.current));
    setBusy(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    setAnswers((a) => ({ ...a, [step.id]: v }));
    // A puzzle shows its reveal first; everything else moves on.
    if (step.kind !== 'puzzle') advance();
  };

  const common = { value, onAnswer: (v: number) => void answer(v), disabled: busy };
  const heading = started && step.title ? tx(step.title) : title;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background" data-testid="task-runner">
      <div className={cn('relative shrink-0 transition-[height] duration-300', started ? 'h-[40dvh] max-h-[26rem] min-h-52' : 'h-[56dvh] max-h-[34rem] min-h-64')}>
        <TaskArt chain={started ? (step.art ?? art) : art} className="absolute inset-0" />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/20 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <span className="shrink-0 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-brand-ink tabular-nums shadow-sm backdrop-blur" data-testid="task-counter">
            {started ? jt('stepOf', { current: nf.format(index + 1), total: nf.format(steps.length) }) : jt('stepsTotal', { total: steps.length })}
          </span>
          <StepDots count={steps.length} current={started ? index : -1} answered={steps.map((s) => answers[s.id] !== undefined)} />
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={jt('back')} className="shrink-0 rounded-full bg-white/90 text-brand-ink shadow-sm backdrop-blur hover:bg-white">
            <X className="size-5" />
          </Button>
        </div>
      </div>

      <section className="relative z-10 -mt-8 flex flex-1 flex-col gap-5 rounded-t-[2rem] bg-background px-5 pt-7 shadow-[0_-12px_24px_-16px_rgb(41_17_55/0.35)]">
        <header>
          <h1 className="text-[1.65rem] font-bold leading-tight tracking-tight text-foreground" data-testid="task-heading">
            {heading}
          </h1>
          <span aria-hidden="true" className="mt-3 block h-1 w-10 rounded-full bg-brand-orange" />
        </header>

        {!started ? (
          <>
            {intro && <p className="text-base text-muted-foreground">{intro}</p>}
            <Button size="lg" onClick={() => setStarted(true)} className="mt-auto mb-[max(env(safe-area-inset-bottom),1rem)] h-14 rounded-2xl text-base" data-testid="task-begin">
              {jt('start')}
              <ArrowRight className="size-5 rtl:rotate-180" />
            </Button>
          </>
        ) : (
          <>
            <div key={step.id} className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200">
              {step.kind === 'swipe' && <SwipeQuestion {...common} text={step.text} scale={step.scale} />}
              {step.kind === 'faces' && <FacesQuestion {...common} text={step.text} scale={step.scale} />}
              {step.kind === 'slider' && <SliderQuestion {...common} text={step.text} scale={step.scale} />}
              {step.kind === 'story' && <StoryQuestion {...common} text={step.text} titled={Boolean(step.title)} />}
              {step.kind === 'choice' && <ChoiceQuestion {...common} a={step.a} b={step.b} />}
              {step.kind === 'scenario' && <ScenarioQuestion {...common} text={step.text} titled={Boolean(step.title)} options={step.options} />}
              {step.kind === 'puzzle' && <PuzzleQuestion {...common} text={step.text} titled={Boolean(step.title)} options={step.options} answer={step.answer} explain={step.explain} />}
              {step.kind === 'enjoy' && <EnjoyQuestion {...common} />}
              {step.kind === 'agree' && <FacesQuestion {...common} text={step.text} scale={step.scale} prompt={jt('readiness.prompt')} />}
            </div>

            {failed && (
              <p role="alert" className="text-sm text-destructive">
                {jt('saveFailed')}
              </p>
            )}

            <footer className="sticky bottom-0 mt-auto flex items-center gap-3 bg-background/95 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 backdrop-blur">
              <Button variant="outline" size="icon" disabled={index === 0 || busy} onClick={() => setIndex(index - 1)} className="size-14 rounded-2xl" aria-label={jt('previous')}>
                <ArrowLeft className="size-5 rtl:rotate-180" />
              </Button>
              {value !== undefined && (
                <Button size="lg" onClick={advance} disabled={busy} className="h-14 flex-1 rounded-2xl text-base" data-testid="task-next">
                  {jt('next')}
                </Button>
              )}
            </footer>
          </>
        )}
      </section>
    </main>
  );
}

/** Progress as dots joined by a line: answered and current steps are filled. Many steps become a bar. */
function StepDots({ count, current, answered }: { count: number; current: number; answered: boolean[] }) {
  if (count > 12)
    return (
      <div aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/60">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(answered.filter(Boolean).length / count) * 100}%` }} />
      </div>
    );
  return (
    <ol aria-hidden="true" className="flex min-w-0 flex-1 items-center">
      {answered.map((done, i) => (
        <li key={i} className={cn('flex items-center', i > 0 && 'flex-1')}>
          {i > 0 && <span className={cn('h-0.5 flex-1', done || i <= current ? 'bg-primary' : 'bg-white/70')} />}
          <span
            className={cn(
              'block shrink-0 rounded-full transition-all',
              i === current ? 'size-3.5 bg-primary ring-2 ring-white' : done ? 'size-2.5 bg-primary' : 'size-2.5 bg-white/80',
            )}
          />
        </li>
      ))}
    </ol>
  );
}
