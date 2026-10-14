'use client';

import { Fish } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { BIG, PATIENCE_DELAYS, SMALL, type PatienceRound } from './patience';
import { useGT } from './use-gt';

type Phase = { kind: 'intro' } | { kind: 'offer'; i: number } | { kind: 'waiting'; i: number; since: number } | { kind: 'caught'; i: number; big: boolean };

/**
 * Patience, playable: six fishing rounds. A small fish now, or wait for a big one; you can stop
 * waiting at any moment. Calls onDone with every round.
 */
export function PatienceGame({ onDone }: { onDone: (rounds: PatienceRound[]) => void }) {
  const gt = useGT();
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });
  const [now, setNow] = useState(0);
  const [basket, setBasket] = useState(0);
  const rounds = useRef<PatienceRound[]>([]);
  const offeredAt = useRef(0);
  const decideMs = useRef(0);

  // While waiting: tick the clock, and land the big fish when the time is up.
  useEffect(() => {
    if (phase.kind !== 'waiting') return;
    const delay = PATIENCE_DELAYS[phase.i]!;
    const h = window.setInterval(() => {
      const t = performance.now();
      setNow(t);
      if ((t - phase.since) / 1000 >= delay) {
        window.clearInterval(h);
        rounds.current.push({ delay, choice: 'waited', waited: delay, decideMs: decideMs.current });
        setBasket((b) => b + BIG);
        setPhase({ kind: 'caught', i: phase.i, big: true });
      }
    }, 100);
    return () => window.clearInterval(h);
  }, [phase]);

  const offer = (i: number) => {
    offeredAt.current = performance.now();
    setPhase({ kind: 'offer', i });
  };

  const takeSmall = () => {
    if (phase.kind !== 'offer' && phase.kind !== 'waiting') return;
    const delay = PATIENCE_DELAYS[phase.i]!;
    if (phase.kind === 'offer') rounds.current.push({ delay, choice: 'now', waited: 0, decideMs: Math.round(performance.now() - offeredAt.current) });
    else rounds.current.push({ delay, choice: 'stopped', waited: Math.round((performance.now() - phase.since) / 100) / 10, decideMs: decideMs.current });
    setBasket((b) => b + SMALL);
    setPhase({ kind: 'caught', i: phase.i, big: false });
  };

  const wait = () => {
    if (phase.kind !== 'offer') return;
    decideMs.current = Math.round(performance.now() - offeredAt.current);
    const since = performance.now();
    setNow(since);
    setPhase({ kind: 'waiting', i: phase.i, since });
  };

  const next = () => {
    if (phase.kind !== 'caught') return;
    if (phase.i + 1 < PATIENCE_DELAYS.length) offer(phase.i + 1);
    else onDone(rounds.current);
  };

  if (phase.kind === 'intro')
    return (
      <div className="flex flex-col gap-4" data-testid="patience-intro">
        <p className="text-lg leading-relaxed">{gt('patience.how')}</p>
        <p className="text-sm text-muted-foreground">{gt('patience.noWrong')}</p>
        <Button size="lg" className="h-14 rounded-2xl text-base" onClick={() => offer(0)}>
          {gt('patience.start')}
        </Button>
      </div>
    );

  const delay = PATIENCE_DELAYS[phase.i]!;
  const progress = phase.kind === 'waiting' ? Math.min(1, (now - phase.since) / 1000 / delay) : phase.kind === 'caught' ? 1 : 0;
  const left = Math.max(0, Math.ceil(delay - (phase.kind === 'waiting' ? (now - phase.since) / 1000 : 0)));

  return (
    <div className="flex flex-col gap-5" data-testid="patience-game">
      <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
        <span>{gt('patience.round', { n: phase.i + 1, total: PATIENCE_DELAYS.length })}</span>
        <span className="flex items-center gap-1" aria-label={gt('patience.basket', { n: basket })}>
          <Fish className="size-4 text-primary" aria-hidden />
          {basket}
        </span>
      </div>

      <div className="relative h-48 overflow-hidden rounded-3xl bg-gradient-to-b from-[#9FD6E2] via-[#2FB8B2] to-[#0E5C73]" aria-hidden>
        <div className="absolute inset-x-0 top-0 h-8 bg-white/20" />
        <Fish
          className={cn('absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow transition-all duration-500', phase.kind === 'caught' && !phase.big ? 'size-10' : 'size-8')}
          strokeWidth={1.5}
        />
        <Fish
          className={cn(
            'absolute top-1/2 -translate-y-1/2 text-[#FFD27A] drop-shadow transition-all duration-500',
            phase.kind === 'caught' && phase.big ? 'left-1/2 size-24 -translate-x-1/2' : 'size-16',
          )}
          style={phase.kind === 'caught' && phase.big ? undefined : { left: `${-20 + progress * 55}%` }}
          strokeWidth={1.5}
        />
      </div>

      {phase.kind === 'offer' && (
        <>
          <p className="text-lg font-semibold">{gt('patience.offer', { s: delay })}</p>
          <div className="grid gap-2">
            <Button size="lg" variant="outline" className="h-14 rounded-2xl text-base" onClick={takeSmall} data-testid="patience-now">
              {gt('patience.now')}
            </Button>
            <Button size="lg" className="h-14 rounded-2xl text-base" onClick={wait} data-testid="patience-wait">
              {gt('patience.wait', { s: delay })}
            </Button>
          </div>
        </>
      )}

      {phase.kind === 'waiting' && (
        <>
          <div className="h-3 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={delay} aria-valuenow={delay - left}>
            <div className="h-full rounded-full bg-primary transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="text-center text-lg font-semibold tabular-nums">{gt('patience.left', { s: left })}</p>
          <Button size="lg" variant="outline" className="h-14 rounded-2xl text-base" onClick={takeSmall} data-testid="patience-stop">
            {gt('patience.stop')}
          </Button>
        </>
      )}

      {phase.kind === 'caught' && (
        <>
          <p className="text-lg font-semibold" role="status">
            {gt(phase.big ? 'patience.gotBig' : 'patience.gotSmall')}
          </p>
          <Button size="lg" className="h-14 rounded-2xl text-base" onClick={next} data-testid="patience-next">
            {gt(phase.i + 1 < PATIENCE_DELAYS.length ? 'patience.next' : 'patience.finish')}
          </Button>
        </>
      )}
    </div>
  );
}
