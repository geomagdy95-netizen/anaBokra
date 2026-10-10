import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Link } from '@/i18n/navigation';
import { SUPPORT_EMAIL } from '@/lib/site';

export const LEGAL_DOCS = ['privacy-policy', 'terms-of-use', 'children-data-notice'] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];

/** Header + footer for the public pages (A1, A5–A8). */
export async function PublicShell({ children }: { children: ReactNode }) {
  const t = await getTranslations('Public.shell');
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:rounded focus:bg-background focus:px-3 focus:py-2">
        {t('skip')}
      </a>
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-xl font-bold text-primary">
            {t('brand')}
          </Link>
          <nav aria-label={t('nav')} className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/careers">{t('careers')}</Link>
            <Link href="/explore">{t('explore')}</Link>
            <Link href="/parents">{t('parents')}</Link>
            <Link href="/schools">{t('schools')}</Link>
            <Link href="/login" className="font-medium">
              {t('login')}
            </Link>
            <LocaleSwitcher />
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        {children}
      </main>
      <footer className="border-t text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6">
          <span>{t('copyright', { year: 2026 })}</span>
          <nav aria-label={t('legal')} className="flex flex-wrap gap-4">
            {LEGAL_DOCS.map((d) => (
              <Link key={d} href={`/legal/${d}`}>
                {t(`docs.${d}`)}
              </Link>
            ))}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{t('contact')}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
