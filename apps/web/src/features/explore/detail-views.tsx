'use client';

import type { Program, Provider, University } from '@anabokra/content';
import { useTranslations } from 'next-intl';

import { SUPPORT_EMAIL } from '@/lib/site';
import { Link } from '@/i18n/navigation';
import { badgeClass, cardClass, linkClass, sectionTitleClass } from '@/features/careers/ui';

import { programName, toProgramRow, type ProgramRow } from './catalog';
import { CutoffText, FeasibilityBadge, FeeText, useGovName, useL, useLangLabel, useNumber, useTrackLabel, useTypeLabel } from './common';
import { assessFeasibility, FEASIBILITY, cutoffPct, latestCutoffs } from './feasibility';
import { placeId } from './governorates';
import { useExplorePersonal } from './personal-context';
import { makeRef } from './saved-ref';
import { SaveButton } from './save-button';


export interface CareerName {
  id: string;
  name: { ar: string; en: string };
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {children}
    </a>
  );
}

export function ReportIssue({ what, path }: { what: string; path: string }) {
  const t = useTranslations('Explore.report');
  const subject = encodeURIComponent(`[anaBokra] ${what}`);
  const body = encodeURIComponent(`${t('mailBody')}\n\n${path}`);
  return (
    <a href={`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`} className={linkClass}>
      {t('cta')}
    </a>
  );
}

function ProgramFit({ row }: { row: ProgramRow }) {
  const t = useTranslations('Explore.feasibility');
  const { data, ready } = useExplorePersonal();
  const n = useNumber();
  if (!ready) return null;
  if (data.expectedScorePct == null) {
    return (
      <p className={cardClass} data-testid="fit-none">
        {data.signedIn ? t('needScoreSignedIn') : t('needScoreSignedOut')}
      </p>
    );
  }
  const f = assessFeasibility(row.cutoffs, row.tracks, { expectedScorePct: data.expectedScorePct, track: data.track });
  return (
    <div className={`${cardClass} space-y-2`} data-testid="fit-panel">
      <h2 className="font-semibold">{t('title')}</h2>
      <p className="text-sm">
        {t('yourScore', { score: n(data.expectedScorePct, { maximumFractionDigits: 2 }) })} <FeasibilityBadge value={f} />
      </p>
      {f.cutoff ? (
        <p className="text-sm text-muted-foreground">
          {t('against')} <CutoffText cutoff={f.cutoff} />
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">{t('disclaimer', { likely: FEASIBILITY.LIKELY_MARGIN_PTS, reach: FEASIBILITY.REACH_BELOW_PTS })}</p>
    </div>
  );
}

/** G4: one program. Score history is a table by year with the scale (410/320) on every row. */
export function ProgramView({ program, university, careers }: { program: Program; university: University | undefined; careers: CareerName[] }) {
  const t = useTranslations('Explore.program');
  const l = useL();
  const n = useNumber();
  const gov = useGovName();
  const type = useTypeLabel();
  const lang = useLangLabel();
  const track = useTrackLabel();
  const row = toProgramRow(program, university);
  const name = programName(program)[l];
  const cutoffs = program.minScores.filter((m) => cutoffPct(m) != null).sort((a, b) => b.year - a.year || a.track.localeCompare(b.track));
  const minimums = program.minScores.filter((m) => m.kind === 'regulatory-minimum').sort((a, b) => b.year - a.year);
  const fee = program.feesEgpPerYear;
  const path = `/explore/programs/${program.id}`;
  const extra = program as Program & { verifiedAt?: string | null; notes?: string | null };

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm">
          <Link href="/explore/search?kind=programs" className={linkClass}>
            {t('back')}
          </Link>
        </p>
        <h1 className="text-3xl font-bold">{name}</h1>
        {university ? (
          <p className="text-lg">
            <Link href={`/explore/universities/${university.id}`} className={linkClass}>
              {university.name[l]}
            </Link>{' '}
            <span className="text-muted-foreground">· {gov(row.governorate)}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {university ? <span className={badgeClass}>{type(university.type)}</span> : null}
          <span className={badgeClass}>{lang(program.teachingLanguage)}</span>
          {program.degree ? <span className={badgeClass}>{program.degree}</span> : null}
          {program.durationYears ? <span className={badgeClass}>{t('years', { count: program.durationYears })}</span> : null}
          {program.acceptedTracks.map((x) => (
            <span key={x} className={badgeClass}>
              {track(x)}
            </span>
          ))}
        </div>
        <SaveButton saveRef={makeRef('program', program.id)} name={name} nextPath={path} />
      </header>

      <ProgramFit row={row} />

      <section aria-labelledby="scores" className="space-y-2">
        <h2 id="scores" className={sectionTitleClass}>
          {t('scoresTitle')}
        </h2>
        {cutoffs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="pb-2 text-start text-muted-foreground">{t('scoresCaption')}</caption>
              <thead>
                <tr className="border-b text-start">
                  <th scope="col" className="p-2 text-start">{t('colYear')}</th>
                  <th scope="col" className="p-2 text-start">{t('colTrack')}</th>
                  <th scope="col" className="p-2 text-start">{t('colPct')}</th>
                  <th scope="col" className="p-2 text-start">{t('colRaw')}</th>
                  <th scope="col" className="p-2 text-start">{t('colSource')}</th>
                </tr>
              </thead>
              <tbody>
                {cutoffs.map((m) => (
                  <tr key={`${m.year}-${m.track}-${m.phase ?? ''}`} className="border-b" data-testid="cutoff-row">
                    <th scope="row" className="p-2 text-start font-medium">{n(m.year, { useGrouping: false })}</th>
                    <td className="p-2">{track(m.track)}</td>
                    <td className="p-2">{n(cutoffPct(m)!, { maximumFractionDigits: 2 })}%</td>
                    <td className="p-2">{m.scoreRaw != null && m.scoreMax ? t('rawOf', { raw: n(m.scoreRaw), max: n(m.scoreMax) }) : t('na')}</td>
                    <td className="p-2">
                      <ExtLink href={m.sourceUrl}>{t('source')}</ExtLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={cardClass}>{t('noCutoffs')}</p>
        )}
        {minimums.length ? (
          <div className={`${cardClass} space-y-1 text-sm`} data-testid="regulatory-minimum">
            <h3 className="font-semibold">{t('minimumTitle')}</h3>
            <p>{t('minimumNote')}</p>
            <ul className="list-disc ps-5">
              {minimums.map((m) => (
                <li key={`${m.year}-${m.track}`}>
                  {t('minimumRow', { year: n(m.year, { useGrouping: false }), pct: n(m.scorePct, { maximumFractionDigits: 2 }), track: track(m.track) })} <ExtLink href={m.sourceUrl}>{t('source')}</ExtLink>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="fees" className="space-y-2">
        <h2 id="fees" className={sectionTitleClass}>
          {t('feesTitle')}
        </h2>
        <p>
          <FeeText fee={row.fee} />
          {fee?.sourceUrl ? (
            <>
              {' · '}
              <ExtLink href={fee.sourceUrl}>{t('source')}</ExtLink>
            </>
          ) : null}
        </p>
        {fee?.note ? <p className="text-sm text-muted-foreground">{fee.note}</p> : null}
        {!fee?.value ? <p className="text-sm text-muted-foreground">{t('feesNone')}</p> : null}
      </section>

      <section aria-labelledby="careers" className="space-y-2">
        <h2 id="careers" className={sectionTitleClass}>
          {t('careersTitle')}
        </h2>
        {program.careerIds.length ? (
          <ul className="flex flex-wrap gap-2">
            {program.careerIds.map((id) => {
              const c = careers.find((x) => x.id === id);
              return c ? (
                <li key={id}>
                  <Link href={`/careers/${id}`} className={linkClass}>
                    {c.name[l]}
                  </Link>
                </li>
              ) : null;
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground">{t('careersNone')}</p>
        )}
      </section>

      <section aria-labelledby="sources" className="space-y-2">
        <h2 id="sources" className={sectionTitleClass}>
          {t('sourcesTitle')}
        </h2>
        <ul className="list-disc space-y-1 ps-5 text-sm">
          <li>
            <ExtLink href={program.sourceUrl}>{t('mainSource')}</ExtLink>
          </li>
          {program.website ? (
            <li>
              <ExtLink href={program.website}>{t('officialSite')}</ExtLink>
            </li>
          ) : null}
        </ul>
        <p className="text-sm text-muted-foreground">{t('verified', { date: extra.verifiedAt ?? '-' })}</p>
        {extra.notes ? <p className="text-sm text-muted-foreground">{extra.notes}</p> : null}
        <p className="text-sm">
          <ReportIssue what={`${name} (${program.id})`} path={path} />
        </p>
      </section>
    </article>
  );
}

/** G3: one university and its programs. */
export function UniversityView({ university, programs }: { university: University; programs: Program[] }) {
  const t = useTranslations('Explore.university');
  const l = useL();
  const gov = useGovName();
  const type = useTypeLabel();
  const path = `/explore/universities/${university.id}`;
  const rows = programs.map((p) => toProgramRow(p, university));
  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm">
          <Link href="/explore/search?kind=universities" className={linkClass}>
            {t('back')}
          </Link>
        </p>
        <h1 className="text-3xl font-bold">{university.name[l]}</h1>
        <div className="flex flex-wrap gap-2">
          <span className={badgeClass}>{type(university.type)}</span>
          <span className={badgeClass}>{[gov(rows[0]?.governorate ?? placeId(university.governorate)), university.city && university.city !== university.governorate ? university.city : null].filter(Boolean).join(' - ')}</span>
        </div>
        <div className="flex flex-wrap items-start gap-4">
          <SaveButton saveRef={makeRef('university', university.id)} name={university.name[l]} nextPath={path} />
          {university.website ? <ExtLink href={university.website}>{t('website')}</ExtLink> : null}
        </div>
      </header>
      <section aria-labelledby="progs" className="space-y-3">
        <h2 id="progs" className={sectionTitleClass}>
          {t('programs', { count: rows.length })}
        </h2>
        {rows.length ? (
          <ul className="grid gap-2 md:grid-cols-2">
            {rows.map((r) => {
              const c = latestCutoffs(programs.find((p) => p.id === r.id)!.minScores)[0];
              return (
                <li key={r.id} className={`${cardClass} space-y-1`}>
                  <Link href={`/explore/programs/${r.id}`} className={`${linkClass} font-semibold`}>
                    {r.name[l]}
                  </Link>
                  <p className="text-sm">{c ? <CutoffText cutoff={c} /> : t('noCutoff')}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={cardClass}>{t('noPrograms')}</p>
        )}
      </section>
      <section className="space-y-2 text-sm">
        <ExtLink href={(universityMeta(university)).sourceUrl}>{t('source')}</ExtLink>
        <p className="text-muted-foreground">{t('verified', { date: universityMeta(university).verifiedAt })}</p>
        <p>
          <ReportIssue what={`${university.name[l]} (${university.id})`} path={path} />
        </p>
      </section>
    </article>
  );
}

const universityMeta = (u: University) => {
  const x = u as University & { sourceUrl?: string; verifiedAt?: string };
  return { sourceUrl: x.sourceUrl ?? u.website ?? '#', verifiedAt: x.verifiedAt ?? '-' };
};

/** G5: one course/training provider. */
export function ProviderView({ provider, careers }: { provider: Provider; careers: CareerName[] }) {
  const t = useTranslations('Explore');
  const l = useL();
  const gov = useGovName();
  const path = `/explore/providers/${provider.id}`;
  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm">
          <Link href="/explore/search?kind=providers" className={linkClass}>
            {t('provider.back')}
          </Link>
        </p>
        <h1 className="text-3xl font-bold">{provider.name[l]}</h1>
        <div className="flex flex-wrap gap-2">
          <span className={badgeClass}>{t(`providerKinds.${provider.kind}` as never)}</span>
          <span className={badgeClass}>{t(`formats.${provider.format}` as never)}</span>
          {provider.governorates.map((g) => (
            <span key={g} className={badgeClass}>
              {gov(placeId(g))}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-start gap-4">
          <SaveButton saveRef={makeRef('provider', provider.id)} name={provider.name[l]} nextPath={path} />
          {provider.website ? <ExtLink href={provider.website}>{t('provider.website')}</ExtLink> : null}
        </div>
      </header>
      <section className="space-y-2">
        <h2 className={sectionTitleClass}>{t('provider.who')}</h2>
        <p>{provider.audience[l]}</p>
        <p className="text-sm text-muted-foreground">
          {provider.ageMin != null || provider.ageMax != null ? t('provider.ages', { min: provider.ageMin ?? '-', max: provider.ageMax ?? '-' }) : t('provider.agesUnknown')}
        </p>
        {provider.notes ? <p className="text-sm text-muted-foreground">{provider.notes[l]}</p> : null}
      </section>
      {provider.skills.length ? (
        <section className="space-y-2">
          <h2 className={sectionTitleClass}>{t('provider.skills')}</h2>
          <ul className="flex flex-wrap gap-2">
            {provider.skills.map((s) => (
              <li key={s} className={badgeClass}>
                {s}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {provider.careerIds.length ? (
        <section className="space-y-2">
          <h2 className={sectionTitleClass}>{t('program.careersTitle')}</h2>
          <ul className="flex flex-wrap gap-3">
            {provider.careerIds.map((id) => {
              const c = careers.find((x) => x.id === id);
              return c ? (
                <li key={id}>
                  <Link href={`/careers/${id}`} className={linkClass}>
                    {c.name[l]}
                  </Link>
                </li>
              ) : null;
            })}
          </ul>
        </section>
      ) : null}
      <section className="space-y-2 text-sm">
        {provider.sourceUrl ? <ExtLink href={provider.sourceUrl}>{t('provider.source')}</ExtLink> : null}
        <p className="text-muted-foreground">{t('provider.verified', { date: provider.verifiedAt ?? '-' })}</p>
        <p>
          <ReportIssue what={`${provider.name[l]} (${provider.id})`} path={path} />
        </p>
      </section>
    </article>
  );
}
