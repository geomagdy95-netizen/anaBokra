import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Link } from '@/i18n/navigation';

import { linkClass } from './ui';

/** Page frame for the careers screens: skip target, section nav and the language switch. */
export function CareersShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const t = useTranslations('Careers');
  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className={`mx-auto flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 ${wide ? 'max-w-6xl' : 'max-w-5xl'}`}>
          <nav aria-label={t('nav.label')} className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/" className="text-lg font-bold text-primary">
              {t('nav.brand')}
            </Link>
            <Link href="/careers" className={linkClass}>
              {t('nav.browse')}
            </Link>
            <Link href="/careers/compare" className={linkClass}>
              {t('nav.compare')}
            </Link>
            <Link href="/careers/favorites" className={linkClass}>
              {t('nav.favorites')}
            </Link>
          </nav>
          <LocaleSwitcher />
        </div>
      </header>
      <main id="main" className={`mx-auto w-full px-4 py-6 ${wide ? 'max-w-6xl' : 'max-w-5xl'}`}>
        {children}
      </main>
    </div>
  );
}
