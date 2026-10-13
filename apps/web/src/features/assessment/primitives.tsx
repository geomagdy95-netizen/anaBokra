'use client';

import { Check } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useMemo, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import type { SaveStatus } from './save-queue';
import { useAT } from './ui-context';

/** Solid, visible keyboard focus (the shadcn default ring is too faint for AA non-text contrast). */
export const FOCUS = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** Answer buttons: at least 48px tall, the whole tile is the touch target. */
export const choiceBase = `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors active:scale-[0.98] ${FOCUS}`;
export const choiceIdle = 'border-input bg-card text-card-foreground hover:border-primary/50 hover:bg-secondary';
export const choiceOn = 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25';

export function useNumberFormat() {
  const locale = useLocale();
  return useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
}

export function ProgressBar({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div className="h-full rounded-full bg-primary motion-safe:transition-[inline-size] motion-safe:duration-[var(--duration-normal)]" style={{ inlineSize: `${pct}%` }} />
    </div>
  );
}

/**
 * 5-point (or any n-point) answer control: a group of buttons, one per scale point, each showing the
 * number and its label. Buttons (not radios) so arrow keys never change the answer by accident.
 */
export function ScaleInput({
  legend,
  min,
  labels,
  value,
  onSelect,
  stacked,
  disabled,
}: {
  legend: string;
  min: number;
  labels: string[];
  value?: number;
  onSelect: (value: number) => void;
  /** One option per row (long labels). */
  stacked?: boolean;
  disabled?: boolean;
}) {
  const nf = useNumberFormat();
  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="sr-only">{legend}</legend>
      <div className={cn('grid gap-2', stacked ? 'grid-cols-1' : 'grid-cols-5')}>
        {labels.map((label, i) => {
          const v = min + i;
          const on = value === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(v)}
              className={cn(
                choiceBase,
                on ? choiceOn : choiceIdle,
                stacked ? 'justify-start text-start' : 'h-full flex-col px-1 text-center text-xs sm:text-sm',
              )}
            >
              <span className={cn('tabular-nums font-semibold', stacked ? 'min-w-6' : 'text-base')}>{nf.format(v)}</span>
              <span className="leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function SaveIndicator({ status, hadActivity }: { status: SaveStatus; hadActivity: boolean }) {
  const at = useAT();
  let text = '';
  let tone = 'text-muted-foreground';
  if (status === 'pending' || status === 'saving') text = at('save.saving');
  else if (status === 'retrying') text = at('save.retrying');
  else if (status === 'offline') [text, tone] = [at('save.offline'), 'text-foreground'];
  else if (status === 'error') [text, tone] = [at('save.error'), 'text-destructive'];
  else if (hadActivity) text = at('save.saved');
  return (
    <p role="status" aria-live="polite" className={cn('flex min-h-5 items-center gap-1 text-sm', tone)}>
      {status === 'idle' && hadActivity && <Check className="size-4" aria-hidden="true" />}
      {text}
    </p>
  );
}

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-xl border bg-card p-4 text-card-foreground sm:p-6', className)} {...rest}>
      {children}
    </div>
  );
}
