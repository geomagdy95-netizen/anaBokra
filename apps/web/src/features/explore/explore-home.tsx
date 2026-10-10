'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { badgeClass, cardClass, linkClass, sectionTitleClass } from '@/features/careers/ui';

import type { ExploreCatalog, ProgramRow } from './catalog';
import { ProgramCard, UniversityCard } from './cards';
import { useGovName, useL, useNumber } from './common';
import { EgyptMap } from './egypt-map';
import { assessFeasibility } from './feasibility';
import { useExplorePersonal } from './personal-context';

export interface CareerName {
  id: string;
  name: { ar: string; en: string };
}

const rank = { likely: 0, reach: 1, unknown: 2, unlikely: 3 } as const;

/** G1: list/map toggle, "for your top careers", "near you" and category chips. */
export function ExploreHome({ catalog, careers }: { catalog: ExploreCatalog; careers: CareerName[] }) {
  const t = useTranslations('Explore.home');
  const l = useL();
  const n = useNumber();
  const gov = useGovName();
  const { data, ready } = useExplorePersonal();
  const [view, setView] = useState<'list' | 'map'>('list');

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const u of catalog.universities) if (u.governorate) out[u.governorate] = (out[u.governorate] ?? 0) + 1;
    return out;
  }, [catalog.universities]);
  const grouped = useMemo(() => {
    const m = new Map<string, typeof catalog.universities>();
    for (const u of catalog.universities) {
      const k = u.governorate ?? '';
      m.set(k, [...(m.get(k) ?? []), u]);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [catalog]);

  const forCareers = useMemo(() => {
    const user = { expectedScorePct: data.expectedScorePct, track: data.track };
    return data.topCareerIds.flatMap((cid) => {
      const career = careers.find((c) => c.id === cid);
      if (!career) return [];
      const hits = catalog.programs
        .filter((p: ProgramRow) => p.careerIds.includes(cid))
        .map((row) => ({ row, feasibility: assessFeasibility(row.cutoffs, row.tracks, user) }))
        .sort((a, b) => rank[a.feasibility.status] - rank[b.feasibility.status])
        .slice(0, 3);
      return hits.length ? [{ career, hits }] : [];
    });
  }, [catalog.programs, careers, data.topCareerIds, data.expectedScorePct, data.track]);

  const near = data.governorate ? catalog.universities.filter((u) => u.governorate === data.governorate).slice(0, 6) : [];

  const chips = [
    { kind: 'universities', count: catalog.universities.length },
    { kind: 'programs', count: catalog.programs.length },
    { kind: 'providers', count: catalog.providers.length },
  ] as const;

  return (
    <div className="space-y-8">
      <nav aria-label={t('categories')}>
        <ul className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <li key={c.kind}>
              <Link href={`/explore/search?kind=${c.kind}`} className={`${badgeClass} min-h-9 px-4 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50`}>
                {t(`chips.${c.kind}`)} ({n(c.count)})
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="top-careers" className="space-y-3">
        <h2 id="top-careers" className={sectionTitleClass}>
          {t('topCareers')}
        </h2>
        {!ready ? (
          <p className="text-muted-foreground" role="status">
            {t('loading')}
          </p>
        ) : forCareers.length === 0 ? (
          <div className={`${cardClass} space-y-2`}>
            <p>{data.signedIn ? t('noResult') : t('signedOut')}</p>
            <Link href={data.signedIn ? '/assessment' : '/login?next=%2Fexplore'} className={linkClass}>
              {data.signedIn ? t('takeAssessment') : t('signIn')}
            </Link>
          </div>
        ) : (
          forCareers.map(({ career, hits }) => (
            <div key={career.id} className="space-y-2">
              <h3 className="text-lg font-semibold">{career.name[l]}</h3>
              <ul className="grid gap-3 md:grid-cols-3">
                {hits.map((h) => (
                  <ProgramCard key={h.row.id} hit={h} nextPath="/explore" />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <section aria-labelledby="near-you" className="space-y-3">
        <h2 id="near-you" className={sectionTitleClass}>
          {t('nearYou')}
        </h2>
        {near.length ? (
          <>
            <p className="text-sm text-muted-foreground">{t('inGov', { name: gov(data.governorate) })}</p>
            <ul className="grid gap-3 md:grid-cols-3">
              {near.map((u) => (
                <UniversityCard key={u.id} row={u} nextPath="/explore" />
              ))}
            </ul>
          </>
        ) : (
          <p className={cardClass}>{ready && data.signedIn ? t('noGovernorate') : t('nearSignedOut')}</p>
        )}
      </section>

      <section aria-labelledby="by-gov" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="by-gov" className={sectionTitleClass}>
            {t('byGovernorate')}
          </h2>
          <div role="group" aria-label={t('viewToggle')} className="flex gap-2">
            {(['list', 'map'] as const).map((v) => (
              <Button key={v} size="sm" variant={view === v ? 'secondary' : 'outline'} aria-pressed={view === v} onClick={() => setView(v)}>
                {t(`view.${v}`)}
              </Button>
            ))}
          </div>
        </div>
        {view === 'map' ? (
          <EgyptMap counts={counts} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {grouped.map(([g, list]) => (
              <li key={g || 'none'} className={cardClass}>
                <h3 className="font-semibold">
                  {g ? (
                    <Link href={`/explore/search?kind=universities&gov=${g}`} className="underline-offset-4 hover:underline">
                      {gov(g)}
                    </Link>
                  ) : (
                    gov(null)
                  )}{' '}
                  <span className="text-muted-foreground">({n(list.length)})</span>
                </h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {list.slice(0, 5).map((u) => (
                    <li key={u.id}>
                      <Link href={`/explore/universities/${u.id}`} className={linkClass}>
                        {u.name[l]}
                      </Link>
                    </li>
                  ))}
                  {list.length > 5 ? <li className="text-muted-foreground">{t('andMore', { count: list.length - 5 })}</li> : null}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
