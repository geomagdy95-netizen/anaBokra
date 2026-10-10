import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Link } from '@/i18n/navigation';

import { salarySpan, type CatalogItem } from './catalog';
import { pick } from './common';
import { FitBadge } from './career-card';
import { linkClass } from './ui';
import { MAX_COMPARE, type CareerPage, type Locale } from './types';

export interface CompareTableProps {
  items: CatalogItem[];
  pages: Record<string, CareerPage | undefined>;
  fits: Record<string, number>;
  hasResult: boolean;
}

/** F4: 2 to 3 careers side by side (fit, path, study years, salary, outlook). */
export function CompareTable({ items, pages, fits, hasResult }: CompareTableProps) {
  const t = useTranslations('Careers');
  const locale = useLocale() as Locale;
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const shown = items.slice(0, MAX_COMPARE);
  const dash = <span className="text-muted-foreground">{t('compare.na')}</span>;

  const rows: { key: string; label: string; cell: (it: CatalogItem) => ReactNode }[] = [
    ...(hasResult
      ? [{ key: 'fit', label: t('compare.rows.fit'), cell: (it: CatalogItem) => (fits[it.id] !== undefined ? <FitBadge fit={fits[it.id]!} className="inline-block" /> : dash) }]
      : []),
    { key: 'cluster', label: t('compare.rows.cluster'), cell: (it) => it.clusterName[locale] },
    { key: 'holland', label: t('compare.rows.holland'), cell: (it) => <bdi dir="ltr">{it.holland}</bdi> },
    {
      key: 'study',
      label: t('compare.rows.study'),
      cell: (it) => (it.studyYears ? t('path.years', { count: it.studyYears }) : dash),
    },
    {
      key: 'tracks',
      label: t('compare.rows.tracks'),
      cell: (it) => (it.tracks?.length ? it.tracks.map((tr) => t(`path.trackNames.${tr}`)).join(' / ') : dash),
    },
    {
      key: 'path',
      label: t('compare.rows.path'),
      cell: (it) => {
        const f = pages[it.id]?.pathEgypt?.faculties?.slice(0, 2);
        return f?.length ? (
          <ul className="list-disc space-y-1 ps-4">
            {f.map((x, i) => (
              <li key={i}>{x[locale]}</li>
            ))}
          </ul>
        ) : (
          dash
        );
      },
    },
    {
      key: 'salary',
      label: t('compare.rows.salary'),
      cell: (it) => {
        const s = salarySpan(pages[it.id]);
        if (s) return <bdi className="tabular-nums">{t('salary.range', { min: nf.format(s.min), max: nf.format(s.max) })}</bdi>;
        return pages[it.id]?.marketEgypt ? <span className="text-muted-foreground">{t('salary.noneShort')}</span> : dash;
      },
    },
    { key: 'outlook', label: t('compare.rows.outlook'), cell: (it) => (it.trend ? t(`trend.${it.trend}`) : dash) },
    {
      key: 'demand',
      label: t('compare.rows.demand'),
      cell: (it) => {
        const d = pages[it.id]?.marketEgypt?.demand;
        return d ? t(`market.demandLevels.${d}`) : dash;
      },
    },
  ];

  return (
    <div role="region" tabIndex={0} aria-label={t('compare.tableLabel')} className="overflow-x-auto rounded-lg border focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <caption className="sr-only">{t('compare.caption')}</caption>
        <thead>
          <tr className="border-b bg-secondary text-start">
            <td className="p-3" />
            {shown.map((it) => (
              <th key={it.id} scope="col" className="p-3 text-start align-top">
                <Link href={`/careers/${it.id}`} className={`${linkClass} text-base font-semibold`}>
                  {it.name[locale]}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b last:border-0 align-top">
              <th scope="row" className="p-3 text-start font-medium text-muted-foreground">
                {r.label}
              </th>
              {shown.map((it) => (
                <td key={it.id} className="p-3">
                  {r.cell(it)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ComparePicker({ items, selected }: { items: CatalogItem[]; selected: string[] }) {
  const t = useTranslations('Careers');
  const locale = useLocale() as Locale;
  const sorted = [...items].sort((a, b) => a.name[locale].localeCompare(b.name[locale], locale));
  return (
    <form method="get" className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-4" aria-label={t('compare.pickerLabel')}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-1">
          <label htmlFor={`compare-pick-${i}`} className="text-sm font-medium">
            {t('compare.pick', { n: new Intl.NumberFormat(locale).format(i + 1) })}
          </label>
          <select
            id={`compare-pick-${i}`}
            name="ids"
            defaultValue={selected[i] ?? ''}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{i < 2 ? t('compare.choose') : t('compare.optional')}</option>
            {sorted.map((c) => (
              <option key={c.id} value={c.id}>
                {pick(c.name, locale)}
              </option>
            ))}
          </select>
        </div>
      ))}
      <div className="flex items-end">
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none">
          {t('compare.submit')}
        </button>
      </div>
    </form>
  );
}
