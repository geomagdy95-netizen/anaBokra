'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { badgeClass, cardClass } from '@/features/careers/ui';

import type { ProviderRow, UniversityRow } from './catalog';
import { CutoffText, FeasibilityBadge, FeeText, useGovName, useL, useLangLabel, useTypeLabel } from './common';
import type { ProgramHit } from './filters';
import { placeId } from './governorates';
import { makeRef } from './saved-ref';
import { SaveButton } from './save-button';

export function ProgramCard({
  hit,
  nextPath,
  compare,
}: {
  hit: ProgramHit;
  nextPath: string;
  compare?: { selected: boolean; onToggle: () => void };
}) {
  const t = useTranslations('Explore.card');
  const l = useL();
  const gov = useGovName();
  const type = useTypeLabel();
  const lang = useLangLabel();
  const { row, feasibility } = hit;
  const cut = feasibility.cutoff ?? row.cutoffs[0] ?? null;
  const name = row.name[l];
  return (
    <li className={`${cardClass} flex flex-col gap-3`} data-testid="program-card">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">
            <Link href={`/explore/programs/${row.id}`} className="underline-offset-4 hover:underline">
              {name}
            </Link>
          </h3>
          <p className="text-sm text-muted-foreground">
            <Link href={`/explore/universities/${row.universityId}`} className="underline-offset-4 hover:underline">
              {row.universityName[l]}
            </Link>
            {' · '}
            {gov(row.governorate)}
          </p>
        </div>
        <FeasibilityBadge value={feasibility} />
      </div>
      <div className="flex flex-wrap gap-2">
        <span className={badgeClass}>{type(row.universityType)}</span>
        <span className={badgeClass}>{lang(row.language)}</span>
        {row.degree ? <span className={badgeClass}>{row.degree}</span> : null}
      </div>
      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">{t('cutoff')}</dt>
          <dd>{cut ? <CutoffText cutoff={cut} /> : row.minimum ? t('minimumOnly') : t('noCutoff')}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('fees')}</dt>
          <dd>
            <FeeText fee={row.fee} />
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-start gap-3">
        <SaveButton saveRef={makeRef('program', row.id)} name={name} nextPath={nextPath} compact />
        {compare ? (
          <label className="flex min-h-9 items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" checked={compare.selected} onChange={compare.onToggle} />
            {t('compareWith', { name })}
          </label>
        ) : null}
      </div>
    </li>
  );
}

export function UniversityCard({ row, nextPath }: { row: UniversityRow; nextPath: string }) {
  const t = useTranslations('Explore.card');
  const l = useL();
  const gov = useGovName();
  const type = useTypeLabel();
  return (
    <li className={`${cardClass} flex flex-col gap-3`} data-testid="university-card">
      <div>
        <h3 className="text-lg font-semibold">
          <Link href={`/explore/universities/${row.id}`} className="underline-offset-4 hover:underline">
            {row.name[l]}
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground">
          {gov(row.governorate)} · {t('programCount', { count: row.programCount })}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className={badgeClass}>{type(row.type)}</span>
      </div>
      <SaveButton saveRef={makeRef('university', row.id)} name={row.name[l]} nextPath={nextPath} compact />
    </li>
  );
}

export function ProviderCard({ row, nextPath }: { row: ProviderRow; nextPath: string }) {
  const t = useTranslations('Explore');
  const l = useL();
  const gov = useGovName();
  return (
    <li className={`${cardClass} flex flex-col gap-3`} data-testid="provider-card">
      <div>
        <h3 className="text-lg font-semibold">
          <Link href={`/explore/providers/${row.id}`} className="underline-offset-4 hover:underline">
            {row.name[l]}
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground">{row.governorates.map((g) => gov(placeId(g))).join(l === 'ar' ? '، ' : ', ')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className={badgeClass}>{t(`providerKinds.${row.kind}` as never)}</span>
        <span className={badgeClass}>{t(`formats.${row.format}` as never)}</span>
      </div>
      <SaveButton saveRef={makeRef('provider', row.id)} name={row.name[l]} nextPath={nextPath} compact />
    </li>
  );
}
