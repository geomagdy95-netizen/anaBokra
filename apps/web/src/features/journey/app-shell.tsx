'use client';

import { ChevronLeft, UserRound } from 'lucide-react';
import { useEffect, type MouseEvent, type ReactNode } from 'react';

import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { useJT } from './use-jt';

/** Which part of the app a screen belongs to (the map is the only navigation; there is no tab bar). */
export type Tab = 'home' | 'explore' | 'saved' | 'account';

// Screens shown since the page loaded. More than one means the user got here inside the app, so
// "back" can return to the screen they came from.
let screensSeen = 0;
let lastPath: string | null = null;

function useTrackScreen() {
  const path = usePathname();
  useEffect(() => {
    if (path === lastPath) return;
    lastPath = path;
    screensSeen += 1;
  }, [path]);
}

/** Counts a screen that isn't framed by AppShell (the public pages), so "back" from a legal page returns there. */
export function ScreenTracker() {
  useTrackScreen();
  return null;
}

/**
 * Round back link for the top bar. With `previous`, it goes back in history when the user came from
 * another screen of the app (a career opened from Explore, Verify or the results), and to `href` otherwise.
 */
function BackLink({ href, previous }: { href: string; previous: boolean }) {
  const jt = useJT();
  const router = useRouter();
  const onClick = (e: MouseEvent) => {
    if (!previous || screensSeen < 2) return;
    e.preventDefault();
    router.back();
  };
  return (
    <Link href={href} onClick={onClick} aria-label={jt(href === '/journey' && !previous ? 'backToMap' : 'backPrevious')} className="grid size-11 shrink-0 place-items-center rounded-full bg-card shadow-sm ring-1 ring-border/70 hover:bg-secondary" data-testid="back">
      <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
    </Link>
  );
}

/**
 * Frame for the screens opened from the map: a top bar with a back link (to the map unless `back` says
 * otherwise), the title and the profile button (or `action`). There is no tab bar: the map is home and
 * every screen leads back to it. `fill` gives the content the whole height under the bar.
 */
export function AppShell({
  tab,
  title,
  subtitle,
  back,
  backToPrevious = false,
  leading,
  action,
  fill = false,
  children,
  testId,
}: {
  tab?: Tab;
  title?: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  /** The back link returns to the previous screen when there is one (see BackLink). */
  backToPrevious?: boolean;
  leading?: ReactNode;
  action?: ReactNode;
  fill?: boolean;
  children: ReactNode;
  testId?: string;
}) {
  useTrackScreen();
  return (
    <div className={cn('mx-auto flex w-full max-w-md flex-col bg-background', fill ? 'h-dvh overflow-hidden' : 'min-h-dvh')} data-testid={testId}>
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-background/90 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur">
        {!leading && <BackLink href={back ?? '/journey'} previous={backToPrevious} />}
        {leading}
        <div className="min-w-0 flex-1">
          {title && <h1 className="truncate text-xl font-bold text-brand-ink dark:text-foreground">{title}</h1>}
          {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action ?? (tab !== 'account' && <AccountButton />)}
      </header>
      <div className={cn('flex-1', fill ? 'relative min-h-0' : 'px-4 pb-12')}>{children}</div>
    </div>
  );
}

/** Round icon link to the account screen, for a top bar (`glass` inside the map's glass header). */
export function AccountButton({ glass = false }: { glass?: boolean }) {
  const jt = useJT();
  return (
    <Link
      href="/journey/account"
      aria-label={jt('nav.account')}
      title={jt('nav.account')}
      className={cn('grid shrink-0 place-items-center rounded-full', glass ? 'size-10 hover:bg-white/60' : 'size-11 bg-card shadow-sm ring-1 ring-border/70 hover:bg-secondary')}
      data-testid="profile-button"
    >
      <UserRound className="size-5" aria-hidden />
    </Link>
  );
}
