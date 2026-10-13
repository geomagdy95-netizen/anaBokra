import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { Logo } from '@/components/brand/logo';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { ScreenTracker } from '@/features/journey/app-shell';
import { Link } from '@/i18n/navigation';
import { DATA_MODE } from '@/lib/data-mode';
import { SUPPORT_EMAIL } from '@/lib/site';

export const LEGAL_DOCS = ['privacy-policy', 'terms-of-use', 'children-data-notice'] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];

/**
 * Header + footer for the public pages (A1, A8), phone first. Phase 1 links only to the app
 * (`/journey`); the phase 2 links (careers, universities, parents, schools, log in) come back with
 * server mode.
 */
export async function PublicShell({ children }: { children: ReactNode }) {
  const t = await getTranslations('Public.shell');
  const ts = await getTranslations('Public.start');
  const locale = (await getLocale()) as 'ar' | 'en';
  const server = DATA_MODE === 'server';

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <ScreenTracker />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2">
        {t('skip')}
      </a>
      <header className="sticky top-0 z-30 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-4 py-2">
          <Link href="/" className="shrink-0 rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
            <Logo locale={locale} className="h-9" />
          </Link>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            {!server && (
              <Button asChild size="sm">
                <Link href="/journey">{ts('cta')}</Link>
              </Button>
            )}
          </div>
        </div>
        {server && (
          <nav aria-label={t('nav')} className="mx-auto flex w-full max-w-3xl gap-1 overflow-x-auto px-3 pb-2 text-sm whitespace-nowrap">
            {(
              [
                ['/careers', 'careers'],
                ['/explore', 'explore'],
                ['/parents', 'parents'],
                ['/schools', 'schools'],
                ['/login', 'login'],
              ] as const
            ).map(([href, key]) => (
              <Link key={href} href={href} className="inline-flex min-h-11 items-center rounded-full px-3 font-medium hover:bg-secondary">
                {t(key)}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-12">
        {children}
      </main>
      <footer className="border-t border-border text-sm text-muted-foreground">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 pt-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <nav aria-label={t('legal')} className="flex flex-wrap gap-x-4">
            {LEGAL_DOCS.map((d) => (
              <Link key={d} href={`/legal/${d}`} className="tap-link">
                {t(`docs.${d}`)}
              </Link>
            ))}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="tap-link">
              {t('contact')}
            </a>
          </nav>
          <span>{t('copyright', { year: 2026 })}</span>
        </div>
      </footer>
    </div>
  );
}
