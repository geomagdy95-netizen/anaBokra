'use client';

import { instruments } from '@anabokra/content';
import type { WorkValue } from '@anabokra/engine';
import { Minus, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { TaskArt } from '@/features/art/task-art-view';
import { useNumberFormat } from '@/features/assessment/primitives';
import { useAT } from '@/features/assessment/ui-context';
import { TOP_VALUES } from '@/features/assessment/values-sort';
import { LocalLoading } from '@/features/local/local-states';
import type { JourneyData } from '@/lib/journey/journey';
import { cn } from '@/lib/utils';

import { useJT } from './use-jt';

const ICON: Record<WorkValue, string> = {
  achievement: '🏆',
  workingConditions: '💰',
  recognition: '⭐',
  relationships: '🤝',
  support: '🛟',
  independence: '🧭',
};

/** The values ranking from a budget: most coins first (the order shown breaks ties), only values with coins. */
export function budgetRanking(coins: Readonly<Record<string, number>>): WorkValue[] {
  const items = instruments.values.budget!.items;
  return [...items]
    .filter((i) => (coins[i.id] ?? 0) > 0)
    .sort((a, b) => (coins[b.id] ?? 0) - (coins[a.id] ?? 0) || items.indexOf(a) - items.indexOf(b))
    .slice(0, TOP_VALUES)
    .map((i) => i.value);
}

/**
 * "Build your dream job" (lever 3, docs/product/discover-verify.md §5.1): 10 coins to spend on what a
 * future job must give you, over the six work values, on one screen. It replaces the 21-card sort for
 * sessions on the budget format. Asked once, then used for every path. Saved together at the end.
 */
export function ValueBudget({ data, onDone, onClose }: { data: JourneyData; onDone: () => void; onClose: () => void }) {
  const jt = useJT();
  const at = useAT();
  const nf = useNumberFormat();
  const budget = instruments.values.budget!;
  const [coins, setCoins] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void data.rt.service.getResume(data.rt.userId, { sessionId: data.sessionId }).then((r) => {
      if (!alive) return;
      const saved = Object.fromEntries(r.responses.filter((x) => budget.items.some((i) => i.id === x.itemId)).map((x) => [x.itemId, x.value]));
      setCoins(Object.fromEntries(budget.items.map((i) => [i.id, saved[i.id] ?? 0])));
    });
    return () => {
      alive = false;
    };
  }, [data, budget]);

  if (!coins) return <LocalLoading />;
  const spent = budget.items.reduce((n, i) => n + coins[i.id]!, 0);
  const left = budget.coins - spent;
  const change = (id: string, delta: number) => setCoins((c) => (c ? { ...c, [id]: Math.max(0, Math.min(budget.coins, c[id]! + delta)) } : c));

  const finish = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await data.rt.service.saveResponses(data.rt.userId, {
        sessionId: data.sessionId,
        station: 'values',
        responses: budget.items.map((i) => ({ itemId: i.id, value: coins[i.id]! })),
      });
      await data.rt.service.completeStation(data.rt.userId, { sessionId: data.sessionId, station: 'values', valuesRanking: budgetRanking(coins) });
      onDone();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background" data-testid="value-budget">
      <div className="relative h-40 shrink-0">
        <TaskArt chain={['tasks/values/cover']} className="absolute inset-0" />
        <Button variant="ghost" size="icon" onClick={onClose} aria-label={jt('back')} className="absolute end-4 top-[max(env(safe-area-inset-top),0.75rem)] rounded-full bg-white/90 text-brand-ink shadow-sm hover:bg-white">
          <X className="size-5" />
        </Button>
      </div>
      <section className="relative z-10 -mt-8 flex flex-1 flex-col gap-4 rounded-t-[2rem] bg-background px-5 pt-6">
        <header>
          <h1 className="text-[1.65rem] font-bold leading-tight tracking-tight">{jt('budget.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{jt('budget.intro', { coins: nf.format(budget.coins) })}</p>
        </header>

        <div className="sticky top-0 z-10 -mx-5 flex items-center justify-between gap-3 bg-background/95 px-5 py-2 backdrop-blur" aria-live="polite">
          <div className="flex flex-wrap gap-0.5" aria-hidden="true">
            {Array.from({ length: budget.coins }, (_, i) => (
              <span key={i} className={cn('text-xl transition-all duration-200', i < left ? 'scale-100' : 'scale-75 opacity-20 grayscale')}>
                🪙
              </span>
            ))}
          </div>
          <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-sm font-bold tabular-nums text-primary" data-testid="budget-left">
            {jt('budget.left', { n: nf.format(left) })}
          </span>
        </div>

        <ul className="flex flex-col gap-2.5">
          {budget.items.map((i) => {
            const n = coins[i.id]!;
            return (
              <li key={i.id} className={cn('flex items-center gap-3 rounded-2xl p-3 ring-1 transition-colors', n ? 'bg-primary/10 ring-primary/40' : 'bg-card ring-border/70')} data-testid="budget-row" data-value={i.value}>
                <span aria-hidden="true" className="text-3xl">
                  {ICON[i.value]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{at(`workValues.${i.value}.name`)}</span>
                  <span className="block text-xs text-muted-foreground">{at(`workValues.${i.value}.desc`)}</span>
                  <span className="mt-1 block min-h-4 text-sm leading-none" aria-hidden="true">
                    {'🪙'.repeat(n)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-10 rounded-full"
                    disabled={!n || busy}
                    onClick={() => change(i.id, -1)}
                    aria-label={jt('budget.less', { name: at(`workValues.${i.value}.name`) })}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="w-6 text-center font-bold tabular-nums">{nf.format(n)}</span>
                  <Button
                    size="icon"
                    className="size-10 rounded-full"
                    disabled={!left || busy}
                    onClick={() => change(i.id, 1)}
                    aria-label={jt('budget.more', { name: at(`workValues.${i.value}.name`) })}
                    data-testid="budget-more"
                  >
                    <Plus className="size-4" />
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>

        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {jt('saveFailed')}
          </p>
        )}
        <footer className="sticky bottom-0 mt-auto bg-background/95 pb-[max(env(safe-area-inset-bottom),1rem)] pt-2 backdrop-blur">
          <Button size="lg" className="h-14 w-full rounded-2xl text-base" disabled={left !== 0 || busy} onClick={() => void finish()} data-testid="budget-done">
            {left ? jt('budget.spendAll', { n: nf.format(left) }) : jt('budget.done')}
          </Button>
        </footer>
      </section>
    </main>
  );
}
