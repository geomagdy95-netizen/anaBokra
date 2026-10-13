'use client';

import { ArrowLeft, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ProgressBar, useNumberFormat } from '@/features/assessment/primitives';

import { ChoiceQuestion, EnjoyQuestion, FacesQuestion, PuzzleQuestion, ScenarioQuestion, SliderQuestion, StoryQuestion, SwipeQuestion } from './questions';
import type { Step } from './steps';
import { useJT } from './use-jt';

export interface TaskRunnerProps {
  title: string;
  intro?: string;
  steps: Step[];
  /** Answers given before (the task resumes at the first unanswered step). */
  initial: Record<string, number>;
  /** Saves one answer. Return false if it couldn't be saved; the step stays on screen. */
  onAnswer: (step: Step, value: number, ms: number) => Promise<boolean>;
  onDone: () => void;
  onClose: () => void;
}

/**
 * Plays one task, one question at a time. Most answers move on by themselves; a puzzle waits on its
 * reveal until "Next". Every answer is saved as it is given, so leaving midway loses nothing.
 */
export function TaskRunner({ title, intro, steps, initial, onAnswer, onDone, onClose }: TaskRunnerProps) {
  const jt = useJT();
  const nf = useNumberFormat();
  const [answers, setAnswers] = useState<Record<string, number>>(initial);
  const [index, setIndex] = useState(() => {
    const i = steps.findIndex((s) => initial[s.id] === undefined);
    return i === -1 ? 0 : i;
  });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = Date.now();
  }, [index]);

  const step = steps[index]!;
  const value = answers[step.id];
  const answered = steps.filter((s) => answers[s.id] !== undefined).length;
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

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-6" data-testid="task-runner">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{title}</h1>
          <p className="text-xs text-muted-foreground tabular-nums">{jt('counter', { current: nf.format(index + 1), total: nf.format(steps.length) })}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label={jt('back')}>
          <X className="size-5" />
        </Button>
      </header>
      <ProgressBar value={answered} max={steps.length} label={title} />
      {intro && index === 0 && answered === 0 && <p className="text-sm text-muted-foreground">{intro}</p>}

      <div key={step.id} className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200">
        {step.kind === 'swipe' && <SwipeQuestion {...common} text={step.text} scale={step.scale} />}
        {step.kind === 'faces' && <FacesQuestion {...common} text={step.text} scale={step.scale} />}
        {step.kind === 'slider' && <SliderQuestion {...common} text={step.text} scale={step.scale} />}
        {step.kind === 'story' && <StoryQuestion {...common} text={step.text} />}
        {step.kind === 'choice' && <ChoiceQuestion {...common} a={step.a} b={step.b} />}
        {step.kind === 'scenario' && <ScenarioQuestion {...common} text={step.text} options={step.options} />}
        {step.kind === 'puzzle' && <PuzzleQuestion {...common} text={step.text} options={step.options} answer={step.answer} explain={step.explain} />}
        {step.kind === 'enjoy' && <EnjoyQuestion {...common} />}
        {step.kind === 'agree' && <FacesQuestion {...common} text={step.text} scale={step.scale} prompt={jt('readiness.prompt')} />}
      </div>

      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {jt('saveFailed')}
        </p>
      )}

      <footer className="sticky bottom-0 mt-auto flex items-center gap-3 bg-background/95 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur">
        <Button variant="outline" size="icon" disabled={index === 0 || busy} onClick={() => setIndex(index - 1)} className="size-14 rounded-2xl" aria-label={jt('previous')}>
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </Button>
        {value !== undefined && (
          <Button size="lg" onClick={advance} disabled={busy} className="flex-1" data-testid="task-next">
            {jt('next')}
          </Button>
        )}
      </footer>
    </main>
  );
}
