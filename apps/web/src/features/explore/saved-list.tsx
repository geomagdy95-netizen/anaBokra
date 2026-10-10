'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { cardClass, linkClass } from '@/features/careers/ui';

import type { ProgramRow, ProviderRow, UniversityRow } from './catalog';
import { ProgramCard, ProviderCard, UniversityCard } from './cards';
import { assessFeasibility } from './feasibility';
import { MAX_COMPARE_PROGRAMS, MIN_COMPARE_PROGRAMS } from './filters';
import { useExplorePersonal } from './personal-context';
import { parseRef } from './saved-ref';

/** G7: the signed-in student's saved opportunities. Consent and storage problems are explained, not thrown. */
export function SavedList({ programs, universities, providers }: { programs: ProgramRow[]; universities: UniversityRow[]; providers: ProviderRow[] }) {
  const t = useTranslations('Explore.savedPage');
  const { data } = useExplorePersonal();
  const user = { expectedScorePct: data.expectedScorePct, track: data.track };
  const path = '/explore/saved';

  if (!data.signedIn) {
    return (
      <div className={`${cardClass} space-y-2`} data-testid="saved-signed-out">
        <p>{t('signedOut')}</p>
        <Link href={`/login?next=${encodeURIComponent(path)}`} className={linkClass}>
          {t('signIn')}
        </Link>
      </div>
    );
  }

  const refs = data.saved.flatMap((r) => {
    const p = parseRef(r);
    return p ? [p] : [];
  });
  const progs = refs.flatMap((r) => (r.kind === 'program' ? programs.filter((p) => p.id === r.id) : []));
  const unis = refs.flatMap((r) => (r.kind === 'university' ? universities.filter((p) => p.id === r.id) : []));
  const provs = refs.flatMap((r) => (r.kind === 'provider' ? providers.filter((p) => p.id === r.id) : []));
  const empty = progs.length + unis.length + provs.length === 0;

  return (
    <div className="space-y-6">
      {data.savedLocked ? (
        <p role="alert" className="rounded-lg border border-destructive/50 p-3 text-sm" data-testid={`saved-${data.savedLocked}`}>
          {data.savedLocked === 'consent_required' ? t('consentRequired') : t('unavailable')}
        </p>
      ) : null}
      {empty ? (
        <div className={`${cardClass} space-y-2`}>
          <p>{t('empty')}</p>
          <Link href="/explore/search" className={linkClass}>
            {t('browse')}
          </Link>
        </div>
      ) : null}
      {progs.length ? (
        <section aria-labelledby="sp" className="space-y-2">
          <h2 id="sp" className="text-xl font-semibold">{t('programs')}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {progs.map((row) => (
              <ProgramCard key={row.id} hit={{ row, feasibility: assessFeasibility(row.cutoffs, row.tracks, user) }} nextPath={path} />
            ))}
          </ul>
          {progs.length >= MIN_COMPARE_PROGRAMS ? (
            <Link href={`/explore/compare?ids=${progs.slice(0, MAX_COMPARE_PROGRAMS).map((p) => p.id).join(',')}`} className={linkClass}>
              {t('compareFirst', { count: Math.min(progs.length, MAX_COMPARE_PROGRAMS) })}
            </Link>
          ) : null}
        </section>
      ) : null}
      {unis.length ? (
        <section aria-labelledby="su" className="space-y-2">
          <h2 id="su" className="text-xl font-semibold">{t('universities')}</h2>
          <ul className="grid gap-3 md:grid-cols-3">
            {unis.map((row) => (
              <UniversityCard key={row.id} row={row} nextPath={path} />
            ))}
          </ul>
        </section>
      ) : null}
      {provs.length ? (
        <section aria-labelledby="sv" className="space-y-2">
          <h2 id="sv" className="text-xl font-semibold">{t('providers')}</h2>
          <ul className="grid gap-3 md:grid-cols-3">
            {provs.map((row) => (
              <ProviderCard key={row.id} row={row} nextPath={path} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
