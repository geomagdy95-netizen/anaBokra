'use client';

import { HelpCircle } from 'lucide-react';
import { useMemo } from 'react';

import { ChoiceGame, type RunInfo } from './choice-game';
import { TIME_LIMIT } from './score';
import { patternRun, type ChoiceAnswer, type Figure } from './pattern';
import { useGT } from './use-gt';

const COLORS = ['#7025B5', '#F08A3E', '#1E9C93'] as const;

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

/** Pattern logic, playable (see pattern.ts). */
export function PatternGame({ seed, onDone }: { seed: number; onDone: (answers: ChoiceAnswer[], info: RunInfo) => void }) {
  const gt = useGT();
  const run = useMemo(() => patternRun(seed), [seed]);
  return (
    <ChoiceGame
      game="pattern"
      run={run}
      seconds={TIME_LIMIT.pattern}
      onDone={onDone}
      prompt={(item) => (
        <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2 rounded-3xl bg-secondary p-2" role="img" aria-label={gt('pattern.gridLabel')}>
          {item.cells.map((cell, i) =>
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
      )}
      option={(o) => <FigureView fig={o} className="size-full" />}
    />
  );
}
