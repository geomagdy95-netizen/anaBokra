'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export function LocaleSwitcher() {
  const t = useTranslations('LocaleSwitcher');
  const current = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t('label')} className="flex items-center gap-1">
      {routing.locales.map((l) => (
        <Button
          key={l}
          asChild
          size="sm"
          variant={l === current ? 'secondary' : 'ghost'}
        >
          <Link href={pathname} locale={l} lang={l} hrefLang={l} aria-current={l === current ? 'true' : undefined}>
            {t(l)}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
