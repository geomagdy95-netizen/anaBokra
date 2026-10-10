'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

import type { CatalogItem } from './catalog';
import { FitBadge } from './career-card';
import { FavoriteButton } from './favorite-button';
import { usePersonal } from './personal-context';
import { cardClass, linkClass } from './ui';
import { MAX_COMPARE, MIN_COMPARE, type Locale } from './types';

/** F5: the signed-in student's saved careers. Removing updates immediately; storage problems are explained, not thrown. */
export function FavoritesList({ catalog }: { catalog: CatalogItem[] }) {
  const t = useTranslations('Careers.favorites');
  const locale = useLocale() as Locale;
  const { data } = usePersonal();
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const items = data.favorites.flatMap((id) => {
    const it = byId.get(id);
    return it ? [it] : [];
  });

  if (!data.signedIn) {
    return (
      <div className={`${cardClass} space-y-2`} data-testid="favorites-signed-out">
        <p>{t('signedOut')}</p>
        <Link href={`/login?next=${encodeURIComponent('/careers/favorites')}`} className={linkClass}>
          {t('signIn')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.favoritesLocked === 'consent_required' ? (
        <p role="alert" className="rounded-lg border border-destructive/50 p-3 text-sm" data-testid="favorites-consent">
          {t('consentRequired')}
        </p>
      ) : data.favoritesLocked === 'unavailable' ? (
        <p role="alert" className="rounded-lg border border-destructive/50 p-3 text-sm">
          {t('unavailable')}
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className={`${cardClass} space-y-2`}>
          <p>{t('empty')}</p>
          <Link href="/careers" className={linkClass}>
            {t('browse')}
          </Link>
        </div>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((it) => (
              <li key={it.id} className={`${cardClass} flex flex-col gap-3`} data-testid="favorite-item">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      <Link href={`/careers/${it.id}`} className="underline-offset-4 hover:underline">
                        {it.name[locale]}
                      </Link>
                    </h2>
                    <p className="text-sm text-muted-foreground">{it.clusterName[locale]}</p>
                  </div>
                  {data.fits[it.id] ? <FitBadge fit={data.fits[it.id]!.fit} /> : null}
                </div>
                <FavoriteButton careerId={it.id} name={it.name[locale]} nextPath="/careers/favorites" compact />
              </li>
            ))}
          </ul>
          {items.length >= MIN_COMPARE ? (
            <Link href={`/careers/compare?ids=${items.slice(0, MAX_COMPARE).map((i) => i.id).join(',')}`} className={linkClass}>
              {t('compareFirst', { count: Math.min(items.length, MAX_COMPARE) })}
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}
