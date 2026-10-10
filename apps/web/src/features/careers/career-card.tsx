'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import type { CatalogItem } from './catalog';
import { FavoriteButton } from './favorite-button';
import { usePersonal } from './personal-context';
import { badgeClass, cardClass } from './ui';
import type { Locale } from './types';

export function FitBadge({ fit, className }: { fit: number; className?: string }) {
  const t = useTranslations('Careers.card');
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return (
    <p className={cn('rounded-md bg-primary px-2 py-1 text-sm font-semibold tabular-nums text-primary-foreground', className)}>
      {t('fit', { n: nf.format(fit) })}
    </p>
  );
}

export function CareerCard({
  item,
  compareChecked,
  compareDisabled,
  onToggleCompare,
}: {
  item: CatalogItem;
  compareChecked: boolean;
  compareDisabled: boolean;
  onToggleCompare: (id: string) => void;
}) {
  const t = useTranslations('Careers');
  const locale = useLocale() as Locale;
  const { data } = usePersonal();
  const fit = data.fits[item.id]?.fit;
  const name = item.name[locale];
  const headingId = `career-${item.id}`;

  return (
    <article aria-labelledby={headingId} className={cn(cardClass, 'flex h-full flex-col gap-3')} data-testid="career-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={headingId} className="text-lg font-semibold leading-snug">
            <Link href={`/careers/${item.id}`} className="underline-offset-4 hover:underline focus-visible:underline">
              {name}
            </Link>
          </h3>
          <p className="text-sm text-muted-foreground">{item.clusterName[locale]}</p>
        </div>
        {fit !== undefined ? <FitBadge fit={fit} className="shrink-0" /> : null}
      </div>

      <ul className="flex flex-wrap gap-2" aria-label={t('card.facts')}>
        <li className={badgeClass}>
          <span className="sr-only">{t('card.holland')}: </span>
          <span dir="ltr">{item.holland}</span>
        </li>
        {item.trend ? (
          <li className={badgeClass}>
            {t('card.outlook')}: {t(`trend.${item.trend}`)}
          </li>
        ) : null}
        {item.hasSalary ? <li className={badgeClass}>{t('card.hasSalary')}</li> : null}
        {item.depth !== 'full' ? <li className={badgeClass}>{t(item.depth === 'lite' ? 'card.lite' : 'card.soon')}</li> : null}
      </ul>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={compareChecked}
            disabled={compareDisabled && !compareChecked}
            onChange={() => onToggleCompare(item.id)}
          />
          <span>
            {t('card.compare')}
            <span className="sr-only">: {name}</span>
          </span>
        </label>
        <FavoriteButton careerId={item.id} name={name} nextPath="/careers" compact />
      </div>
    </article>
  );
}
