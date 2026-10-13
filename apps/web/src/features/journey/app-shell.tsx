'use client';

import { Bookmark, ChevronLeft, Compass, House, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { useJT } from './use-jt';

export type Tab = 'home' | 'explore' | 'saved' | 'account';

const TABS: { id: Tab; href: string; Icon: typeof House }[] = [
  { id: 'home', href: '/journey', Icon: House },
  { id: 'explore', href: '/journey/map', Icon: Compass },
  { id: 'saved', href: '/journey/saved', Icon: Bookmark },
  { id: 'account', href: '/journey/account', Icon: UserRound },
];

/** The bottom tab bar (reference board): Home · Explore · Saved · Account. In RTL the first tab sits on the right. */
export function TabBar({ tab }: { tab: Tab }) {
  const jt = useJT();
  return (
    <nav
      aria-label={jt('nav.label')}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md rounded-t-3xl border-t border-border bg-card/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-8px_30px_rgba(41,17,55,0.08)] backdrop-blur"
    >
      <ul className="grid grid-cols-4">
        {TABS.map(({ id, href, Icon }) => {
          const active = id === tab;
          return (
            <li key={id}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn('flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none', active ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
                data-testid={`tab-${id}`}
              >
                <span className={cn('grid h-8 w-14 place-items-center rounded-full transition-colors', active && 'bg-primary text-primary-foreground shadow-md shadow-primary/30')}>
                  <Icon className="size-5" aria-hidden />
                </span>
                {jt(`nav.${id}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Screen frame for the journey tabs: a top bar (optional back link, title, trailing action) and the
 * tab bar. `fill` gives the content the whole height between them (the Explore map).
 */
export function AppShell({
  tab,
  title,
  subtitle,
  back,
  leading,
  action,
  fill = false,
  children,
  testId,
}: {
  tab: Tab;
  title?: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  leading?: ReactNode;
  action?: ReactNode;
  fill?: boolean;
  children: ReactNode;
  testId?: string;
}) {
  const jt = useJT();
  return (
    <div className={cn('mx-auto flex w-full max-w-md flex-col bg-background', fill ? 'h-dvh overflow-hidden' : 'min-h-dvh')} data-testid={testId}>
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-background/90 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur">
        {back && (
          <Link href={back} aria-label={jt('back')} className="grid size-11 shrink-0 place-items-center rounded-full bg-card shadow-sm ring-1 ring-border/70 hover:bg-secondary">
            <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
          </Link>
        )}
        {leading}
        <div className="min-w-0 flex-1">
          {title && <h1 className="truncate text-xl font-bold text-brand-ink dark:text-foreground">{title}</h1>}
          {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className={cn('flex-1', fill ? 'relative min-h-0 pb-[4.75rem]' : 'px-4 pb-28')}>{children}</div>
      <TabBar tab={tab} />
    </div>
  );
}

/** Round icon link to the Account tab, for the top bar. */
export function AccountButton() {
  const jt = useJT();
  return (
    <Link href="/journey/account" aria-label={jt('nav.account')} className="grid size-11 shrink-0 place-items-center rounded-full bg-card shadow-sm ring-1 ring-border/70 hover:bg-secondary">
      <UserRound className="size-5" aria-hidden />
    </Link>
  );
}
