'use client';

import { instruments } from '@anabokra/content';
import { RIASEC, type Riasec } from '@anabokra/engine';
import { useEffect, useState } from 'react';

import { useNumberFormat } from '@/features/assessment/primitives';
import { cn } from '@/lib/utils';

import { useJT } from './use-jt';

const ICON: Record<Riasec, string> = { R: '🔧', I: '🔬', A: '🎨', S: '🤝', E: '🚀', C: '🗂️' };

/**
 * How strong each interest type is so far (0–1), from the interest cards answered: the mean answer,
 * rescaled. Only for showing progress; the scores that count come from the engine.
 */
export function interestsSoFar(answers: Readonly<Record<string, number>>): Record<Riasec, { level: number; answered: number }> {
  const { min, max } = instruments.interests.responseScale;
  const out = {} as Record<Riasec, { level: number; answered: number }>;
  for (const type of RIASEC) {
    const values = instruments.interests.items
      .filter((i) => i.scale === type && !i.attentionCheck && answers[i.id] !== undefined)
      .map((i) => (i.keyed === -1 ? min + max - answers[i.id]! : answers[i.id]!));
    const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : min;
    out[type] = { level: (mean - min) / (max - min), answered: values.length };
  }
  return out;
}

/**
 * The six interest types as bars that grow with every task (lever 5 in docs/product/discover-verify.md
 * §3): after a task the bars move from where they were (`before`) to where they are now, and the two
 * strongest types are named. Nothing shows until a first interest card is answered.
 */
export function InterestCompass({ answers, before, compact = false }: { answers: Readonly<Record<string, number>>; before?: Readonly<Record<string, number>>; compact?: boolean }) {
  const jt = useJT();
  const nf = useNumberFormat();
  const now = interestsSoFar(answers);
  const then = before ? interestsSoFar(before) : now;
  // Start at the old widths, then let the bars grow to the new ones.
  const [grown, setGrown] = useState(!before);
  useEffect(() => {
    const t = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  if (RIASEC.every((t) => now[t].answered === 0)) return null;
  const ranked = [...RIASEC].sort((a, b) => now[b].level - now[a].level || RIASEC.indexOf(a) - RIASEC.indexOf(b));
  const lead = ranked.slice(0, 2);

  return (
    <section className={cn('rounded-3xl bg-card shadow-sm ring-1 ring-border/70', compact ? 'p-4' : 'p-5')} data-testid="interest-compass">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{jt('compass.title')}</p>
      <p className="mt-1 text-lg font-bold" data-testid="compass-lead">
        {jt('compass.lead', { a: `${ICON[lead[0]!]} ${jt(`compass.types.${lead[0]}`)}`, b: `${ICON[lead[1]!]} ${jt(`compass.types.${lead[1]}`)}` })}
      </p>
      <ul className={cn('mt-3 flex flex-col', compact ? 'gap-1.5' : 'gap-2')}>
        {RIASEC.map((t) => {
          const level = grown ? now[t].level : then[t].level;
          const up = Boolean(before) && now[t].level > then[t].level + 0.001;
          return (
            <li key={t} className="flex items-center gap-2 text-sm">
              <span aria-hidden="true" className="w-6 text-center">
                {ICON[t]}
              </span>
              <span className={cn('w-24 shrink-0 truncate', lead.includes(t) && 'font-semibold')}>{jt(`compass.types.${t}`)}</span>
              <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                <span
                  className={cn('absolute inset-y-0 start-0 rounded-full transition-[width] duration-700 ease-out', lead.includes(t) ? 'bg-primary' : 'bg-primary/45')}
                  style={{ width: `${Math.max(4, level * 100)}%` }}
                />
              </span>
              <span className="sr-only">{nf.format(Math.round(now[t].level * 100))}%</span>
              <span aria-hidden="true" className={cn('w-4 text-xs text-brand-orange', !up && 'invisible')}>
                ▲
              </span>
            </li>
          );
        })}
      </ul>
      {!compact && <p className="mt-3 text-xs text-muted-foreground">{jt('compass.note')}</p>}
    </section>
  );
}
