'use client';

import type { IndustryTrend } from '@anabokra/content';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

import type { CatalogItem } from './catalog';
import { CareerCard } from './career-card';
import { DEFAULT_FILTERS, filterCatalog, sortCatalog, toggleCompare, type Filters, type SortKey } from './filters';
import { usePersonal } from './personal-context';
import { cardClass, fieldClass } from './ui';
import { MAX_COMPARE, MIN_COMPARE, TRACKS, type Locale } from './types';

const TRENDS: IndustryTrend[] = ['growing', 'stable', 'transforming', 'declining'];
const FIT_STEPS = [50, 60, 70, 80];

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

/** F1: filterable, searchable, sortable list of every career. The full list is server-rendered; filters run on the client. */
export function CareerBrowser({ items, clusterOptions }: { items: CatalogItem[]; clusterOptions: { id: string; name: { en: string; ar: string } }[] }) {
  const t = useTranslations('Careers');
  const locale = useLocale() as Locale;
  const nf = new Intl.NumberFormat(locale);
  const uid = useId();
  const { data, ready } = usePersonal();

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>('name');
  const [compare, setCompare] = useState<string[]>([]);
  const [limitNote, setLimitNote] = useState(false);

  // Once the user's fit arrives, order by it by default (once; the user can change it afterwards).
  const autoSorted = useRef(false);
  useEffect(() => {
    if (data.hasResult && !autoSorted.current) {
      autoSorted.current = true;
      setSort('fit');
    }
  }, [data.hasResult]);

  const fitNumbers = useMemo(() => Object.fromEntries(Object.entries(data.fits).map(([id, f]) => [id, f.fit])), [data.fits]);
  const visible = useMemo(() => sortCatalog(filterCatalog(items, filters, fitNumbers), sort, fitNumbers, locale), [items, filters, fitNumbers, sort, locale]);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const dirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const atLimit = compare.length >= MAX_COMPARE;

  function onToggleCompare(id: string) {
    const r = toggleCompare(compare, id);
    setCompare(r.ids);
    setLimitNote(r.blocked);
  }

  const compareHref = `/careers/compare?ids=${compare.join(',')}`;
  const selected = compare.map((id) => items.find((i) => i.id === id)?.name[locale] ?? id);

  return (
    <div className="flex flex-col gap-6">
      <form role="search" aria-label={t('browser.filtersLabel')} className={`${cardClass} grid gap-4 sm:grid-cols-2 lg:grid-cols-3`} onSubmit={(e) => e.preventDefault()}>
        <Field id={`${uid}-q`} label={t('browser.search')}>
          <input
            id={`${uid}-q`}
            type="search"
            className={fieldClass}
            value={filters.query}
            placeholder={t('browser.searchPlaceholder')}
            autoComplete="off"
            onChange={(e) => set('query', e.target.value)}
          />
        </Field>
        <Field id={`${uid}-cluster`} label={t('browser.cluster')}>
          <select id={`${uid}-cluster`} className={fieldClass} value={filters.cluster} onChange={(e) => set('cluster', e.target.value)}>
            <option value="">{t('browser.allClusters')}</option>
            {clusterOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name[locale]}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${uid}-track`} label={t('browser.track')}>
          <select id={`${uid}-track`} className={fieldClass} value={filters.track} onChange={(e) => set('track', e.target.value as Filters['track'])}>
            <option value="">{t('browser.anyTrack')}</option>
            {TRACKS.map((tr) => (
              <option key={tr} value={tr}>
                {t(`tracks.${tr}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${uid}-trend`} label={t('browser.outlook')}>
          <select id={`${uid}-trend`} className={fieldClass} value={filters.trend} onChange={(e) => set('trend', e.target.value as Filters['trend'])}>
            <option value="">{t('browser.anyOutlook')}</option>
            {TRENDS.map((tr) => (
              <option key={tr} value={tr}>
                {t(`trend.${tr}`)}
              </option>
            ))}
          </select>
        </Field>
        {data.hasResult ? (
          <Field id={`${uid}-fit`} label={t('browser.minFit')}>
            <select id={`${uid}-fit`} className={fieldClass} value={filters.minFit} onChange={(e) => set('minFit', Number(e.target.value))}>
              <option value={0}>{t('browser.anyFit')}</option>
              {FIT_STEPS.map((n) => (
                <option key={n} value={n}>
                  {t('browser.fitAtLeast', { n: nf.format(n) })}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field id={`${uid}-sort`} label={t('browser.sort')}>
          <select id={`${uid}-sort`} className={fieldClass} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="name">{t('sort.name')}</option>
            {data.hasResult ? <option value="fit">{t('sort.fit')}</option> : null}
            <option value="study">{t('sort.study')}</option>
            <option value="salary">{t('sort.salary')}</option>
          </select>
        </Field>
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={filters.hasSalary} onChange={(e) => set('hasSalary', e.target.checked)} />
            {t('browser.salaryOnly')}
          </label>
          {dirty ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
              {t('browser.reset')}
            </Button>
          ) : null}
        </div>
      </form>

      {ready && !data.hasResult ? (
        <p className="text-sm text-muted-foreground">
          {t('browser.fitHint')}{' '}
          <Link href="/assessment" className="text-primary underline underline-offset-4">
            {t('browser.fitHintCta')}
          </Link>
        </p>
      ) : null}

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground" data-testid="result-count">
        {t('browser.count', { count: visible.length })}
      </p>

      {visible.length === 0 ? (
        <div className={`${cardClass} flex flex-col items-start gap-3`}>
          <p>{t('browser.empty')}</p>
          <Button type="button" variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>
            {t('browser.reset')}
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <li key={item.id}>
              <CareerCard item={item} compareChecked={compare.includes(item.id)} compareDisabled={atLimit} onToggleCompare={onToggleCompare} />
            </li>
          ))}
        </ul>
      )}

      {compare.length > 0 ? (
        <section aria-label={t('compare.barLabel')} className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-lg">
          <div className="min-w-0 text-sm">
            <p className="font-medium">{t('compare.selected', { count: compare.length, max: MAX_COMPARE })}</p>
            <p className="truncate text-muted-foreground">{selected.join(' · ')}</p>
            <p role="status" aria-live="polite" className="text-destructive empty:hidden">
              {limitNote || atLimit ? t('compare.limit', { max: MAX_COMPARE }) : compare.length < MIN_COMPARE ? t('compare.needMore', { min: MIN_COMPARE }) : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => (setCompare([]), setLimitNote(false))}>
              {t('compare.clear')}
            </Button>
            {compare.length >= MIN_COMPARE ? (
              <Button asChild>
                <Link href={compareHref}>{t('compare.go')}</Link>
              </Button>
            ) : (
              <Button disabled>{t('compare.go')}</Button>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
