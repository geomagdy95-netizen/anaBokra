'use client';

import { Check } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { ChoiceAnswer } from './pattern';
import { useGT } from './use-gt';

/** Milliseconds, for answer times (only ever read in event handlers). */
const clock = () => performance.now();

export interface ChoiceItem {
  level: number;
  options: readonly unknown[];
  answer: number;
}

/**
 * The shared play loop of the choice games: a how-to, one practice item with feedback, then the
 * items with no feedback and no clock. Each game says how its puzzle and options look; message keys
 * come from `Games.<game>` (title, how, ask, explain, done) and `Games.common`.
 */
export function ChoiceGame<I extends ChoiceItem>({
  game,
  run,
  prompt,
  option,
  columns = 4,
  onDone,
}: {
  game: string;
  run: { practice: I; items: I[] };
  prompt: (item: I) => ReactNode;
  option: (o: I['options'][number]) => ReactNode;
  columns?: 2 | 4;
  onDone: (answers: ChoiceAnswer[]) => void;
}) {
  const gt = useGT();
  const [phase, setPhase] = useState<{ kind: 'intro' } | { kind: 'practice'; picked?: number } | { kind: 'item'; i: number }>({ kind: 'intro' });
  const answers = useRef<ChoiceAnswer[]>([]);
  const shownAt = useRef(0);
  const item = phase.kind === 'practice' ? run.practice : phase.kind === 'item' ? run.items[phase.i]! : null;

  const show = (next: typeof phase) => {
    shownAt.current = clock();
    setPhase(next);
  };

  const pick = (k: number) => {
    if (phase.kind === 'practice') {
      if (phase.picked === undefined) setPhase({ kind: 'practice', picked: k });
      return;
    }
    if (phase.kind !== 'item' || !item) return;
    answers.current.push({ level: item.level, correct: k === item.answer, ms: Math.round(clock() - shownAt.current) });
    if (phase.i + 1 < run.items.length) show({ kind: 'item', i: phase.i + 1 });
    else onDone(answers.current);
  };

  if (phase.kind === 'intro' || !item)
    return (
      <div className="flex flex-col gap-4" data-testid={`${game}-intro`}>
        <p className="text-lg leading-relaxed">{gt(`${game}.how`)}</p>
        <p className="text-sm text-muted-foreground">{gt('common.calm')}</p>
        <Button size="lg" className="h-14 rounded-2xl text-base" onClick={() => show({ kind: 'practice' })} data-testid={`${game}-practice`}>
          {gt('common.practice')}
        </Button>
      </div>
    );

  const practiced = phase.kind === 'practice' && phase.picked !== undefined;
  return (
    <div className="flex flex-col gap-5" data-testid={`${game}-game`}>
      <div className="flex items-center justify-between gap-3 text-sm font-medium text-muted-foreground">
        <span>{phase.kind === 'practice' ? gt('common.practiceLabel') : gt('common.counter', { n: phase.kind === 'item' ? phase.i + 1 : 0, total: run.items.length })}</span>
        <span className="text-end">{gt(`${game}.ask`)}</span>
      </div>
      {prompt(item)}
      <div className={cn('grid gap-2', columns === 4 ? 'grid-cols-4' : 'grid-cols-2')} role="group" aria-label={gt('common.optionsLabel')}>
        {item.options.map((o, k) => {
          const isAnswer = practiced && k === item.answer;
          const wrongPick = practiced && phase.kind === 'practice' && k === phase.picked && k !== item.answer;
          return (
            <button
              key={k}
              type="button"
              onClick={() => pick(k)}
              aria-label={gt('common.option', { n: k + 1 })}
              className={cn(
                'grid place-items-center rounded-2xl bg-card p-1 shadow-sm ring-2 transition active:scale-95',
                columns === 4 ? 'aspect-square' : 'min-h-16',
                isAnswer ? 'ring-brand-success' : wrongPick ? 'ring-destructive' : 'ring-border hover:ring-primary',
              )}
              data-testid={`${game}-option-${k}`}
            >
              {option(o)}
            </button>
          );
        })}
      </div>
      {practiced && phase.kind === 'practice' && (
        <div className="flex flex-col gap-3 rounded-2xl bg-brand-orange-soft/20 p-4" role="status">
          <p className="flex items-center gap-2 font-semibold">
            {phase.picked === item.answer && <Check className="size-5 text-brand-success" aria-hidden />}
            {gt(phase.picked === item.answer ? 'common.right' : 'common.wrong')}
          </p>
          <p className="text-sm">{gt(`${game}.explain`)}</p>
          <Button onClick={() => show({ kind: 'item', i: 0 })} data-testid={`${game}-start`}>
            {gt('common.start', { n: run.items.length })}
          </Button>
        </div>
      )}
    </div>
  );
}
