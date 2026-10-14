'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { ChoiceGame, type RunInfo } from './choice-game';
import { BOARD, memoryPath, nextLength, type MemoryTrial } from './memory';
import { numberRun } from './numbers';
import type { ChoiceAnswer } from './pattern';
import { rotationRun, type Shape } from './rotation';
import { TIME_LIMIT } from './score';
import { useGT } from './use-gt';

// --- Quick numbers --------------------------------------------------------------

/** Quick numbers, playable (see numbers.ts). Maths reads left to right in both languages. */
export function NumbersGame({ seed, onDone }: { seed: number; onDone: (answers: ChoiceAnswer[], info: RunInfo) => void }) {
  const run = useMemo(() => numberRun(seed), [seed]);
  return (
    <ChoiceGame
      game="numbers"
      run={run}
      columns={2}
      seconds={TIME_LIMIT.numbers}
      onDone={onDone}
      prompt={(item) => (
        <div dir="ltr" className="flex flex-wrap items-center justify-center gap-1.5 rounded-3xl bg-secondary px-3 py-5" data-testid="numbers-prompt">
          {item.terms.map((t, i) => (
            <span
              key={i}
              className={cn(
                'min-w-10 rounded-2xl px-2 py-2 text-center text-xl font-bold tabular-nums',
                t.includes('?') ? 'border-2 border-dashed border-primary/60 bg-background text-primary' : /^[×−=]/.test(t) ? 'text-muted-foreground' : 'bg-background',
              )}
            >
              {t}
            </span>
          ))}
        </div>
      )}
      option={(o) => (
        <span dir="ltr" className="text-2xl font-bold tabular-nums">
          {o}
        </span>
      )}
    />
  );
}

// --- Turn the shape ------------------------------------------------------------------

/** A shape of squares, centred in a square view. */
export function ShapeView({ shape, className, color = '#7025B5' }: { shape: Shape; className?: string; color?: string }) {
  const w = Math.max(...shape.map((c) => c[0])) + 1;
  const h = Math.max(...shape.map((c) => c[1])) + 1;
  const size = Math.max(w, h) + 1;
  const ox = (size - w) / 2;
  const oy = (size - h) / 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} aria-hidden="true">
      {shape.map(([x, y], i) => (
        <rect key={i} x={x + ox + 0.04} y={y + oy + 0.04} width={0.92} height={0.92} rx={0.14} fill={color} />
      ))}
    </svg>
  );
}

/** Turn the shape, playable (see rotation.ts). */
export function RotationGame({ seed, onDone }: { seed: number; onDone: (answers: ChoiceAnswer[], info: RunInfo) => void }) {
  const gt = useGT();
  const run = useMemo(() => rotationRun(seed), [seed]);
  return (
    <ChoiceGame
      game="rotation"
      run={run}
      seconds={TIME_LIMIT.rotation}
      onDone={onDone}
      prompt={(item) => (
        <div className="mx-auto grid size-40 place-items-center rounded-3xl bg-secondary p-3" role="img" aria-label={gt('rotation.targetLabel')}>
          <ShapeView shape={item.target} className="size-full" color="#F08A3E" />
        </div>
      )}
      option={(o) => <ShapeView shape={o} className="size-full p-1" />}
    />
  );
}

// --- Remember the path ---------------------------------------------------------------

const LIT_MS = 650;
const GAP_MS = 250;

type MemoryPhase = { kind: 'intro' } | { kind: 'show'; path: number[]; step: number } | { kind: 'input'; path: number[] } | { kind: 'feedback'; path: number[]; correct: boolean };

/**
 * Remember the path, playable (see memory.ts): watch the tiles light up, then tap them in the same
 * order. Taps are ignored while the path plays.
 */
export function MemoryGame({ seed, onDone }: { seed: number; onDone: (trials: MemoryTrial[]) => void }) {
  const gt = useGT();
  const [phase, setPhase] = useState<MemoryPhase>({ kind: 'intro' });
  const [tapped, setTapped] = useState<number[]>([]);
  const trials = useRef<MemoryTrial[]>([]);
  // Each new path gets its own seed, so a retry at the same length is a different path.
  const begin = (length: number, n: number): MemoryPhase => ({ kind: 'show', path: memoryPath(length, seed + n * 977), step: -1 });

  // Play the path: light each tile in turn, then hand over to the player.
  useEffect(() => {
    if (phase.kind !== 'show') return;
    const h = window.setTimeout(
      () => (phase.step + 1 < phase.path.length * 2 ? setPhase({ ...phase, step: phase.step + 1 }) : setPhase({ kind: 'input', path: phase.path })),
      phase.step % 2 === 0 ? LIT_MS : GAP_MS,
    );
    return () => window.clearTimeout(h);
  }, [phase]);

  // After feedback, start the next path or finish.
  useEffect(() => {
    if (phase.kind !== 'feedback') return;
    const h = window.setTimeout(() => {
      const next = nextLength(trials.current);
      if (next === null) onDone(trials.current);
      else {
        setTapped([]);
        setPhase(begin(next, trials.current.length));
      }
    }, 900);
    return () => window.clearTimeout(h);
  });

  const tap = (t: number) => {
    if (phase.kind !== 'input') return;
    const next = [...tapped, t];
    setTapped(next);
    const ok = phase.path[next.length - 1] === t;
    if (!ok || next.length === phase.path.length) {
      trials.current.push({ length: phase.path.length, correct: ok });
      setPhase({ kind: 'feedback', path: phase.path, correct: ok });
    }
  };

  if (phase.kind === 'intro')
    return (
      <div className="flex flex-col gap-4" data-testid="memory-intro">
        <p className="text-lg leading-relaxed">{gt('memory.how')}</p>
        <p className="text-sm text-muted-foreground">{gt('memory.calm')}</p>
        <Button size="lg" className="h-14 rounded-2xl text-base" onClick={() => setPhase(begin(nextLength([])!, 0))} data-testid="memory-start">
          {gt('memory.start')}
        </Button>
      </div>
    );

  const lit = phase.kind === 'show' && phase.step >= 0 && phase.step % 2 === 0 ? phase.path[phase.step / 2] : undefined;
  return (
    <div className="flex flex-col gap-5" data-testid="memory-game">
      <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
        <span>{gt('memory.length', { n: phase.path.length })}</span>
        <span role="status">
          {phase.kind === 'show' ? gt('memory.watch') : phase.kind === 'input' ? gt('memory.yourTurn') : gt(phase.correct ? 'memory.right' : 'memory.miss')}
        </span>
      </div>
      <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-3 rounded-3xl bg-secondary p-3">
        {Array.from({ length: BOARD }, (_, t) => (
          <button
            key={t}
            type="button"
            onClick={() => tap(t)}
            disabled={phase.kind !== 'input'}
            aria-label={gt('memory.tile', { n: t + 1 })}
            className={cn(
              'aspect-square rounded-2xl transition-colors duration-150',
              lit === t ? 'bg-brand-orange shadow-lg shadow-brand-orange/40' : 'bg-background',
              phase.kind === 'input' && 'active:bg-primary/30',
              phase.kind === 'feedback' && (phase.correct ? 'ring-2 ring-brand-success' : 'ring-2 ring-destructive/60'),
            )}
            data-testid={`memory-tile-${t}`}
          />
        ))}
      </div>
      {phase.kind === 'input' && (
        <p className="text-center text-sm text-muted-foreground tabular-nums">
          {tapped.length} / {phase.path.length}
        </p>
      )}
    </div>
  );
}
