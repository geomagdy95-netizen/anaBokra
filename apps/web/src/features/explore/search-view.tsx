'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cardClass, fieldClass, linkClass } from '@/features/careers/ui';

import { TEACHING_LANGUAGES, TRACK_IDS, UNIVERSITY_TYPES, type ExploreCatalog } from './catalog';
import { ProgramCard, ProviderCard, UniversityCard } from './cards';
import { useGovName, useLangLabel, useTrackLabel, useTypeLabel } from './common';
import { EMPTY_PROGRAM_FILTERS, filterPrograms, filterProviders, filterUniversities, MAX_COMPARE_PROGRAMS, MIN_COMPARE_PROGRAMS, toggleCompare, type FeasibilityFilter, type ProgramFilters } from './filters';
import { GOVERNORATES } from '@/features/assessment/governorates';
import { useExplorePersonal } from './personal-context';

type Kind = 'programs' | 'universities' | 'providers';
const KINDS: Kind[] = ['programs', 'universities', 'providers'];
const PAGE = 24;

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

/** G2: search and filters over programs, universities and providers. */
export function SearchView({ catalog }: { catalog: ExploreCatalog }) {
  const t = useTranslations('Explore.search');
  const gov = useGovName();
  const type = useTypeLabel();
  const lang = useLangLabel();
  const track = useTrackLabel();
  const params = useSearchParams();
  const { data } = useExplorePersonal();

  const initialKind = KINDS.includes(params.get('kind') as Kind) ? (params.get('kind') as Kind) : 'programs';
  const [kind, setKind] = useState<Kind>(initialKind);
  const [f, setF] = useState<ProgramFilters>(() => ({
    ...EMPTY_PROGRAM_FILTERS,
    q: params.get('q') ?? '',
    governorate: (GOVERNORATES as readonly string[]).includes(params.get('gov') ?? '') ? (params.get('gov') as string) : '',
    type: params.get('type') ?? '',
  }));
  const [compare, setCompare] = useState<string[]>([]);
  const [full, setFull] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const set = <K extends keyof ProgramFilters>(k: K, v: ProgramFilters[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setLimit(PAGE);
  };
  const num = (v: string) => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Math.max(0, Number(v)));

  const user = { expectedScorePct: data.expectedScorePct, track: data.track };
  const hits = useMemo(() => filterPrograms(catalog.programs, f, user), [catalog.programs, f, data.expectedScorePct, data.track]); // eslint-disable-line react-hooks/exhaustive-deps
  const unis = useMemo(() => filterUniversities(catalog.universities, f), [catalog.universities, f]);
  const provs = useMemo(() => filterProviders(catalog.providers, f), [catalog.providers, f]);
  const total = kind === 'programs' ? hits.length : kind === 'universities' ? unis.length : provs.length;
  const noScore = data.expectedScorePct == null;
  const nextPath = '/explore/search';

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label={t('kindLabel')} className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Button key={k} role="tab" aria-selected={kind === k} variant={kind === k ? 'secondary' : 'outline'} size="sm" onClick={() => { setKind(k); setLimit(PAGE); }}>
            {t(`kinds.${k}`)}
          </Button>
        ))}
      </div>

      <form role="search" aria-label={t('filtersLabel')} className={`${cardClass} grid gap-3 sm:grid-cols-2 lg:grid-cols-4`} onSubmit={(e) => e.preventDefault()}>
        <Field id="q" label={t('q')}>
          <input id="q" type="search" className={fieldClass} value={f.q} placeholder={t('qPlaceholder')} onChange={(e) => set('q', e.target.value)} />
        </Field>
        {kind !== 'providers' ? (
          <Field id="type" label={t('type')}>
            <select id="type" className={fieldClass} value={f.type} onChange={(e) => set('type', e.target.value)}>
              <option value="">{t('any')}</option>
              {UNIVERSITY_TYPES.map((v) => (
                <option key={v} value={v}>
                  {type(v)}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field id="gov" label={t('governorate')}>
          <select id="gov" className={fieldClass} value={f.governorate} onChange={(e) => set('governorate', e.target.value)}>
            <option value="">{t('any')}</option>
            {GOVERNORATES.map((g) => (
              <option key={g} value={g}>
                {gov(g)}
              </option>
            ))}
          </select>
        </Field>
        {kind === 'programs' ? (
          <>
            <Field id="track" label={t('track')}>
              <select id="track" className={fieldClass} value={f.track} onChange={(e) => set('track', e.target.value)}>
                <option value="">{t('any')}</option>
                {TRACK_IDS.map((v) => (
                  <option key={v} value={v}>
                    {track(v)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="lang" label={t('language')}>
              <select id="lang" className={fieldClass} value={f.language} onChange={(e) => set('language', e.target.value)}>
                <option value="">{t('any')}</option>
                {TEACHING_LANGUAGES.map((v) => (
                  <option key={v} value={v}>
                    {lang(v)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="feeMin" label={t('feeMin')}>
              <input id="feeMin" type="number" inputMode="numeric" min={0} step={1000} className={fieldClass} value={f.feeMin ?? ''} onChange={(e) => set('feeMin', num(e.target.value))} />
            </Field>
            <Field id="feeMax" label={t('feeMax')}>
              <input id="feeMax" type="number" inputMode="numeric" min={0} step={1000} className={fieldClass} value={f.feeMax ?? ''} onChange={(e) => set('feeMax', num(e.target.value))} />
            </Field>
            <Field id="feas" label={t('feasibility')}>
              <select id="feas" className={fieldClass} value={f.feasibility} disabled={noScore} aria-describedby="feas-hint" onChange={(e) => set('feasibility', e.target.value as FeasibilityFilter)}>
                <option value="any">{t('any')}</option>
                <option value="likely">{t('feas.likely')}</option>
                <option value="reach">{t('feas.reach')}</option>
                <option value="unlikely">{t('feas.unlikely')}</option>
              </select>
            </Field>
          </>
        ) : null}
        <div className="flex items-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => { setF(EMPTY_PROGRAM_FILTERS); setLimit(PAGE); }}>
            {t('reset')}
          </Button>
        </div>
      </form>

      {kind === 'programs' ? (
        <p id="feas-hint" className="text-sm text-muted-foreground">
          {noScore ? t('feasNeedsScore') : t('feasHint', { score: data.expectedScorePct ?? 0 })} {t('feeHint')}
        </p>
      ) : null}

      <p role="status" aria-live="polite" className="text-sm font-medium">
        {t('count', { count: total })}
      </p>

      {kind === 'programs' ? (
        <>
          <div className={`${cardClass} flex flex-wrap items-center gap-3 text-sm`} aria-label={t('tray')}>
            <span>{t('selected', { count: compare.length, max: MAX_COMPARE_PROGRAMS })}</span>
            {compare.length >= MIN_COMPARE_PROGRAMS ? (
              <Link href={`/explore/compare?ids=${compare.join(',')}`} className={linkClass}>
                {t('goCompare')}
              </Link>
            ) : (
              <span className="text-muted-foreground">{t('pickMore', { min: MIN_COMPARE_PROGRAMS })}</span>
            )}
            <span role="alert" className="text-destructive empty:hidden">
              {full ? t('compareFull', { max: MAX_COMPARE_PROGRAMS }) : ''}
            </span>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {hits.slice(0, limit).map((h) => (
              <ProgramCard
                key={h.row.id}
                hit={h}
                nextPath={nextPath}
                compare={{
                  selected: compare.includes(h.row.id),
                  onToggle: () => {
                    const r = toggleCompare(compare, h.row.id);
                    setCompare(r.ids);
                    setFull(r.full);
                  },
                }}
              />
            ))}
          </ul>
        </>
      ) : kind === 'universities' ? (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {unis.slice(0, limit).map((r) => (
            <UniversityCard key={r.id} row={r} nextPath={nextPath} />
          ))}
        </ul>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {provs.slice(0, limit).map((r) => (
            <ProviderCard key={r.id} row={r} nextPath={nextPath} />
          ))}
        </ul>
      )}

      {total === 0 ? <p className={cardClass}>{t('empty')}</p> : null}
      {total > limit ? (
        <Button type="button" variant="outline" onClick={() => setLimit((n) => n + PAGE)}>
          {t('more', { shown: Math.min(limit, total), total })}
        </Button>
      ) : null}
    </div>
  );
}
