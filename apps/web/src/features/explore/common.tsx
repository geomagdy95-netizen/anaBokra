'use client';

import { useLocale, useTranslations } from 'next-intl';

import { badgeClass } from '@/features/careers/ui';
import { cn } from '@/lib/utils';

import type { Bi, Locale } from './catalog';
import type { Cutoff, Feasibility } from './feasibility';

export function useL() {
  return useLocale() as Locale;
}

export const pick = (b: Bi, l: Locale) => b[l];

/** Governorate display name for an id; "nationwide"/"online" and unknown values fall back sensibly. */
export function useGovName() {
  const t = useTranslations('Assessment.governorates');
  const e = useTranslations('Explore.place');
  return (id: string | null | undefined): string => {
    if (!id) return e('unknown');
    if (id === 'nationwide' || id === 'online') return e(id);
    try {
      return t(id as never);
    } catch {
      return id;
    }
  };
}

export function useNumber() {
  const locale = useL();
  return (n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', opts).format(n);
}

/** "92.44% (379/410), 2023" with its scale. */
export function CutoffText({ cutoff, showSource = true }: { cutoff: Cutoff; showSource?: boolean }) {
  const t = useTranslations('Explore.score');
  const n = useNumber();
  const ex = n(cutoff.pct, { maximumFractionDigits: 2 });
  return (
    <span>
      <span className="font-medium">{ex}%</span>
      {cutoff.raw != null && cutoff.max ? <span className="text-muted-foreground"> ({n(cutoff.raw)}/{n(cutoff.max)})</span> : null}
      <span className="text-muted-foreground"> · {t('cutoffYear', { year: n(cutoff.year, { useGrouping: false }) })}</span>
      {showSource ? (
        <>
          {' · '}
          <a href={cutoff.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            {t('source')}
          </a>
        </>
      ) : null}
    </span>
  );
}

const TONE: Record<string, string> = {
  likely: 'bg-primary/15 text-foreground',
  reach: 'bg-accent text-accent-foreground',
  unlikely: 'bg-destructive/10 text-foreground',
  unknown: 'bg-muted text-muted-foreground',
};

/** Feasibility label. The text always carries the meaning; colour is secondary. */
export function FeasibilityBadge({ value }: { value: Feasibility }) {
  const t = useTranslations('Explore.feasibility');
  const n = useNumber();
  const label = value.status === 'unknown' ? t(`unknown_${value.reason}`) : t(value.status);
  return (
    <span className={cn(badgeClass, TONE[value.status])} data-testid="feasibility" data-status={value.status}>
      {label}
      {value.status !== 'unknown' ? <span className="sr-only">{t('deltaSr', { delta: n(Math.abs(value.delta), { maximumFractionDigits: 1 }), dir: value.delta >= 0 ? 'above' : 'below' })}</span> : null}
    </span>
  );
}

export function FeeText({ fee }: { fee: { value: number; year: number | null } | null }) {
  const t = useTranslations('Explore.fees');
  const n = useNumber();
  if (!fee) return <span className="text-muted-foreground">{t('unknown')}</span>;
  return (
    <span>
      {t('perYear', { amount: n(fee.value) })}
      {fee.year ? <span className="text-muted-foreground"> · {t('year', { year: n(fee.year, { useGrouping: false }) })}</span> : null}
    </span>
  );
}

export function useTypeLabel() {
  const t = useTranslations('Explore.types');
  return (type: string) => {
    try {
      return t(type as never);
    } catch {
      return type;
    }
  };
}

export function useLangLabel() {
  const t = useTranslations('Explore.languages');
  return (v: string | null) => (v ? t(v as never) : t('unknown'));
}

export function useTrackLabel() {
  const t = useTranslations('Explore.tracks');
  return (v: string) => {
    try {
      return t(v as never);
    } catch {
      return v;
    }
  };
}
