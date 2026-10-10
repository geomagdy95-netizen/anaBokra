import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function PageTitle({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="mb-6 space-y-1">
      <h1 className="text-2xl font-bold">{title}</h1>
      {intro ? <p className="max-w-prose text-sm text-muted-foreground">{intro}</p> : null}
    </div>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function DataTable({ head, children, caption }: { head: ReactNode[]; children: ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-muted/50 text-start">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-3 py-2 text-start font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className, numeric }: { children: ReactNode; className?: string; numeric?: boolean }) {
  return <td className={cn('px-3 py-2 align-top', numeric && 'tabular-nums', className)}>{children}</td>;
}

const TONES = {
  neutral: 'bg-muted text-foreground',
  good: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
  warn: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
  bad: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100',
} as const;

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap', TONES[tone])}>{children}</span>;
}

/** Horizontal bar used for funnels and distributions (no chart library needed). */
export function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3" role="img" aria-label={label}>
      <div className="h-2.5 flex-1 overflow-hidden rounded bg-muted">
        <div className="h-full rounded bg-primary" style={{ inlineSize: `${pct}%` }} />
      </div>
    </div>
  );
}

export const fmtDate = (iso: string | null, locale: string) =>
  iso ? new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium' }).format(new Date(iso)) : '—';

export const fmtNum = (n: number | null | undefined, digits = 2) => (n === null || n === undefined ? '—' : n.toFixed(digits));
