'use client';

import { Check, HelpCircle } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { patternRun, type Figure, type PatternAnswer } from './pattern';
import { useGT } from './use-gt';

const COLORS = ['#7025B5', '#F08A3E', '#1E9C93'] as const;

/** Milliseconds, for answer times (only ever read in event handlers). */
const clock = () => performance.now();

/** Where the 1, 2 or 3 shapes sit in a cell (out of 100). */
const SPOTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [30, 50],
    [70, 50],
  ],
  3: [
    [50, 28],
    [28, 70],
    [72, 70],
  ],
};

function Shape({ kind, x, y, r, color, fill }: { kind: number; x: number; y: number; r: number; color: string; fill: number }) {
  const paint = { fill: fill === 2 ? 'white' : color, fillOpacity: fill === 1 ? 0.3 : 1, stroke: color, strokeWidth: 4, strokeLinejoin: 'round' as const };
  if (kind === 0) return <circle cx={x} cy={y} r={r} {...paint} />;
  if (kind === 1) return <rect x={x - r * 0.9} y={y - r * 0.9} width={r * 1.8} height={r * 1.8} rx={3} {...paint} />;
  return <path d={`M${x} ${y - r} L${x + r} ${y + r * 0.8} L${x - r} ${y + r * 0.8} Z`} {...paint} />;
}

/** One cell of the grid: 1–3 shapes of one kind, colour and fill. */
export function FigureView({ fig, className }: { fig: Figure; className?: string }) {
  const n = fig.count + 1;
  const r = n === 1 ? 22 : n === 2 ? 16 : 14;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {SPOTS[n]!.map(([x, y], i) => (
        <Shape key={i} kind={fig.shape} x={x} y={y} r={r} color={COLORS[fig.color]!} fill={fig.fill} />
      ))}
    </svg>
  );
}

type Phase = { kind: 'intro' } | { kind: 'practice'; picked?: number } | { kind: 'item'; i: number };

/**
 * Pattern logic, playable: a how-to, one practice item with feedback, then eight items with no
 * feedback (as in a real test). Calls onDone with every answer and its time.
 */
export function PatternGame({ seed, onDone }: { seed: number; onDone: (answers: PatternAnswer[]) => void }) {
  const gt = useGT();
  const run = useMemo(() => patternRun(seed), [seed]);
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });
  const answers = useRef<PatternAnswer[]>([]);
  const shownAt = useRef(0);

  const item = phase.kind === 'practice' ? run.practice : phase.kind === 'item' ? run.items[phase.i]! : null;

  const start = (next: Phase) => {
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
    if (phase.i + 1 < run.items.length) start({ kind: 'item', i: phase.i + 1 });
    else onDone(answers.current);
  };

  if (phase.kind === 'intro')
    return (
      <div className="flex flex-col gap-4" data-testid="pattern-intro">
        <p className="text-lg leading-relaxed">{gt('pattern.how')}</p>
        <p className="text-sm text-muted-foreground">{gt('pattern.calm')}</p>
        <Button size="lg" className="h-14 rounded-2xl text-base" onClick={() => start({ kind: 'practice' })}>
          {gt('pattern.practice')}
        </Button>
      </div>
    );

  const practiced = phase.kind === 'practice' && phase.picked !== undefined;
  return (
    <div className="flex flex-col gap-5" data-testid="pattern-game">
      <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
        <span>{phase.kind === 'practice' ? gt('pattern.practiceLabel') : gt('pattern.counter', { n: phase.kind === 'item' ? phase.i + 1 : 0, total: run.items.length })}</span>
        <span>{gt('pattern.ask')}</span>
      </div>
      <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2 rounded-3xl bg-secondary p-2" role="img" aria-label={gt('pattern.gridLabel')}>
        {item!.cells.map((cell, i) =>
          i === 8 ? (
            <div key={i} className="grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-primary/50 bg-background text-primary">
              <HelpCircle className="size-8" aria-hidden />
            </div>
          ) : (
            <div key={i} className="aspect-square rounded-2xl bg-background p-1">
              <FigureView fig={cell} className="size-full" />
            </div>
          ),
        )}
      </div>
      <div className="grid grid-cols-4 gap-2" role="group" aria-label={gt('pattern.optionsLabel')}>
        {item!.options.map((o, k) => {
          const isAnswer = practiced && k === item!.answer;
          const wrongPick = practiced && phase.kind === 'practice' && k === phase.picked && k !== item!.answer;
          return (
            <button
              key={k}
              type="button"
              onClick={() => pick(k)}
              aria-label={gt('pattern.option', { n: k + 1 })}
              className={cn(
                'aspect-square rounded-2xl bg-card p-1 shadow-sm ring-2 transition active:scale-95',
                isAnswer ? 'ring-brand-success' : wrongPick ? 'ring-destructive' : 'ring-border hover:ring-primary',
              )}
              data-testid={`pattern-option-${k}`}
            >
              <FigureView fig={o} className="size-full" />
            </button>
          );
        })}
      </div>
      {practiced && phase.kind === 'practice' && (
        <div className="flex flex-col gap-3 rounded-2xl bg-brand-orange-soft/20 p-4" role="status">
          <p className="flex items-center gap-2 font-semibold">
            {phase.picked === item!.answer && <Check className="size-5 text-brand-success" aria-hidden />}
            {gt(phase.picked === item!.answer ? 'pattern.right' : 'pattern.wrong')}
          </p>
          <p className="text-sm">{gt('pattern.explain')}</p>
          <Button onClick={() => start({ kind: 'item', i: 0 })} data-testid="pattern-start">
            {gt('pattern.start')}
          </Button>
        </div>
      )}
    </div>
  );
}
