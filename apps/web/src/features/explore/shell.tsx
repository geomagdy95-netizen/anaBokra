import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Link } from '@/i18n/navigation';
import { linkClass } from '@/features/careers/ui';

/** Page frame for the explore screens. */
export function ExploreShell({ children }: { children: ReactNode }) {
  const t = useTranslations('Explore.nav');
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-10 focus:rounded-md focus:bg-background focus:p-2">
        {t('skip')}
      </a>
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <nav aria-label={t('label')} className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/" className="text-lg font-bold text-primary">
              {t('brand')}
            </Link>
            <Link href="/explore" className={linkClass}>
              {t('home')}
            </Link>
            <Link href="/explore/search" className={linkClass}>
              {t('search')}
            </Link>
            <Link href="/explore/compare" className={linkClass}>
              {t('compare')}
            </Link>
            <Link href="/explore/saved" className={linkClass}>
              {t('saved')}
            </Link>
          </nav>
          <LocaleSwitcher />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
