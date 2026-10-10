'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { cardClass, linkClass } from '@/features/careers/ui';

import type { ProgramRow } from './catalog';
import { CutoffText, FeasibilityBadge, FeeText, useGovName, useL, useLangLabel, useNumber, useTrackLabel, useTypeLabel } from './common';
import { assessFeasibility } from './feasibility';
import { MAX_COMPARE_PROGRAMS, MIN_COMPARE_PROGRAMS } from './filters';
import { useExplorePersonal } from './personal-context';

/** G6: side-by-side comparison of 2-3 programs. Regulatory minimums appear on their own labelled row. */
export function CompareView({ rows, requested }: { rows: ProgramRow[]; requested: number }) {
  const t = useTranslations('Explore.compare');
  const l = useL();
  const n = useNumber();
  const gov = useGovName();
  const type = useTypeLabel();
  const lang = useLangLabel();
  const track = useTrackLabel();
  const { data } = useExplorePersonal();

  if (rows.length < MIN_COMPARE_PROGRAMS) {
    return (
      <div className={`${cardClass} space-y-2`} data-testid="compare-empty">
        <p>{t('needMore', { min: MIN_COMPARE_PROGRAMS, max: MAX_COMPARE_PROGRAMS })}</p>
        <Link href="/explore/search?kind=programs" className={linkClass}>
          {t('pick')}
        </Link>
      </div>
    );
  }

  const user = { expectedScorePct: data.expectedScorePct, track: data.track };
  const lines: { key: string; label: string; cell: (r: ProgramRow) => React.ReactNode }[] = [
    { key: 'uni', label: t('rows.university'), cell: (r) => <Link href={`/explore/universities/${r.universityId}`} className={linkClass}>{r.universityName[l]}</Link> },
    { key: 'type', label: t('rows.type'), cell: (r) => type(r.universityType) },
    { key: 'gov', label: t('rows.governorate'), cell: (r) => gov(r.governorate) },
    { key: 'degree', label: t('rows.degree'), cell: (r) => r.degree ?? t('na') },
    { key: 'years', label: t('rows.years'), cell: (r) => (r.years ? n(r.years) : t('na')) },
    { key: 'lang', label: t('rows.language'), cell: (r) => lang(r.language) },
    { key: 'tracks', label: t('rows.tracks'), cell: (r) => r.tracks.map(track).join(l === 'ar' ? '، ' : ', ') },
    {
      key: 'cutoff',
      label: t('rows.cutoff'),
      cell: (r) =>
        r.cutoffs.length ? (
          <ul className="space-y-1">
            {r.cutoffs.map((c) => (
              <li key={c.track}>
                {track(c.track)}: <CutoffText cutoff={c} />
              </li>
            ))}
          </ul>
        ) : (
          t('noCutoff')
        ),
    },
    { key: 'min', label: t('rows.minimum'), cell: (r) => (r.minimum ? t('minimumValue', { pct: n(r.minimum.pct, { maximumFractionDigits: 2 }), year: n(r.minimum.year, { useGrouping: false }) }) : t('na')) },
    { key: 'fee', label: t('rows.fees'), cell: (r) => <FeeText fee={r.fee} /> },
    { key: 'feas', label: t('rows.feasibility'), cell: (r) => <FeasibilityBadge value={assessFeasibility(r.cutoffs, r.tracks, user)} /> },
  ];

  return (
    <div className="space-y-3">
      {requested > rows.length ? <p role="status" className="text-sm text-muted-foreground">{t('someMissing')}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm" data-testid="compare-table">
          <caption className="pb-2 text-start text-muted-foreground">{t('caption', { count: rows.length })}</caption>
          <thead>
            <tr className="border-b">
              <td className="p-2" />
              {rows.map((r) => (
                <th key={r.id} scope="col" className="p-2 text-start align-top">
                  <Link href={`/explore/programs/${r.id}`} className={linkClass}>
                    {r.name[l]}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.key} className="border-b align-top">
                <th scope="row" className="p-2 text-start font-medium">{line.label}</th>
                {rows.map((r) => (
                  <td key={r.id} className="p-2">{line.cell(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{t('minimumNote')}</p>
    </div>
  );
}
