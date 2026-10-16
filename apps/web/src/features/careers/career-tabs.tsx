'use client';

import { Briefcase, GraduationCap, Mountain, TrendingUp, Wallet } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';

import { track, trackView } from '@/lib/local/usage';
import type { UsageAction } from '@/lib/stats-summary';

const ICONS = { pay: Wallet, study: GraduationCap, demand: Briefcase, future: TrendingUp, entry: Mountain } as const;

export interface QuickFact {
  icon: keyof typeof ICONS;
  label: string;
  value: string;
  /** A second, quieter line (for example the Thanaweya tracks under the study years). */
  sub?: string;
  /** Tab opened when the tile is tapped. */
  tab: string;
  /** Spans the whole row (the entry difficulty under the four facts). */
  wide?: boolean;
}

export interface CareerTab {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * The career page body: tappable fact tiles over a sticky tab bar. Every panel stays in the DOM
 * (hidden when not active) so the static page keeps all its text for search and printing.
 */
export function CareerTabs({
  facts,
  factsLabel,
  tabs,
  tabsLabel,
  stickyClass,
  careerId,
  tabAction = 'career_tab',
}: {
  facts: QuickFact[];
  factsLabel: string;
  tabs: CareerTab[];
  tabsLabel: string;
  stickyClass: string;
  /** On a career page: counts the page as viewed (anonymous statistics, opt-in only). */
  careerId?: string;
  /** Which usage counter a tab switch adds to. */
  tabAction?: UsageAction;
}) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  useEffect(() => {
    if (careerId) trackView(careerId);
  }, [careerId]);
  // Taps inside the panels that matter for the statistics: opening a myth, a hurdle's source, match details.
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (el.closest('[data-testid="myth"] summary')) track('myth_open');
    else if (el.closest('[data-testid="hurdle"] a')) track('hurdle_source');
    else if (el.closest('[data-testid="match-row"] summary')) track('match_details');
  };
  const barRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const open = (id: string, scroll: boolean) => {
    if (id !== active) track(scroll ? 'career_fact' : tabAction);
    setActive(id);
    if (scroll) barRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.id === active);
    // Arrow direction follows the reading direction (right is "back" in Arabic).
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    const step = (e.key === 'ArrowRight') !== rtl ? 1 : -1;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + step + tabs.length) % tabs.length;
    const id = tabs[next]!.id;
    setActive(id);
    tabRefs.current[id]?.focus();
  };

  return (
    <>
      {facts.length ? (
        <ul className="grid grid-cols-2 gap-3 @2xl:grid-cols-4" aria-label={factsLabel} data-testid="quick-facts">
          {facts.map((f) => {
            const Icon = ICONS[f.icon];
            return (
              <li key={f.icon} className={f.wide ? 'col-span-2 @2xl:col-span-4' : undefined}>
                <button
                  type="button"
                  onClick={() => open(f.tab, true)}
                  className="flex h-full w-full flex-col items-start gap-1 rounded-2xl border border-border bg-card p-3 text-start shadow-sm outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Icon className="size-4 text-primary" aria-hidden />
                    {f.label}
                  </span>
                  <span className="text-base font-bold leading-snug">{f.value}</span>
                  {f.sub ? <span className="text-xs text-muted-foreground">{f.sub}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div ref={barRef} className={`sticky z-10 -mx-1 scroll-mt-20 bg-background/95 px-1 py-2 backdrop-blur ${stickyClass}`}>
        <div role="tablist" aria-label={tabsLabel} onKeyDown={onKey} className="flex gap-1 overflow-x-auto rounded-full bg-secondary p-1">
          {tabs.map((t) => {
            const selected = t.id === active;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => open(t.id, false)}
                className={`min-h-11 flex-1 whitespace-nowrap rounded-full px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
                  selected ? 'bg-card text-primary shadow-sm' : 'text-secondary-foreground/75 hover:text-primary'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tabs.map((t) => (
        <div key={t.id} onClickCapture={onClickCapture} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={t.id !== active} className="space-y-8">
          {t.content}
        </div>
      ))}
    </>
  );
}
