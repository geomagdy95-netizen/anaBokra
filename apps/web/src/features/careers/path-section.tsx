import { programById, providerById, universityById, type Program } from '@anabokra/content';
import { useLocale, useTranslations } from 'next-intl';

import { BulletList, pick, SubHeading } from './common';
import { latestMinScore } from './programs';
import { badgeClass, cardClass, linkClass } from './ui';
import type { CareerPage, Locale } from './types';

function ProgramRow({ program }: { program: Program }) {
  const t = useTranslations('Careers.path');
  const locale = useLocale() as Locale;
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const uni = universityById(program.universityId);
  const score = latestMinScore(program);
  const title = program.program ? `${program.faculty[locale]} - ${program.program[locale]}` : program.faculty[locale];

  return (
    <li className={`${cardClass} space-y-2`} data-testid="program">
      <div>
        <h4 className="font-semibold">{uni ? uni.name[locale] : program.universityId}</h4>
        <p className="text-sm text-muted-foreground">{title}</p>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label={t('programFacts')}>
        {program.degree ? <li className={badgeClass}>{program.degree}</li> : null}
        {program.durationYears ? <li className={badgeClass}>{t('years', { count: program.durationYears })}</li> : null}
        {program.teachingLanguage ? <li className={badgeClass}>{t(`languages.${program.teachingLanguage}`)}</li> : null}
        {uni ? <li className={badgeClass}>{t(`uniType.${uni.type}`)}</li> : null}
      </ul>
      <p className="text-sm">
        <span className="font-medium">{t('minScore')}: </span>
        {score ? (
          <span>
            <bdi className="tabular-nums">{nf.format(score.scorePct)}%</bdi>{' '}
            <span className="text-muted-foreground">
              ({t('year', { year: String(score.year) })}
              {score.scoreRaw !== undefined && score.scoreMax ? `, ${t('scale', { raw: nf.format(score.scoreRaw), max: nf.format(score.scoreMax) })}` : ''}
              {`, ${t(score.kind === 'tansik-phase1-cutoff' ? 'kindTansik' : 'kindFloor')}`})
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">{t('noScore')}</span>
        )}
      </p>
      {program.website ? (
        <p className="text-sm">
          <a href={program.website} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {t('website')}
          </a>
        </p>
      ) : null}
    </li>
  );
}

export function PathSection({ path, providerIds }: { path: NonNullable<CareerPage['pathEgypt']>; providerIds?: string[] }) {
  const t = useTranslations('Careers.path');
  const locale = useLocale() as Locale;
  const programs = (path.programIds ?? []).flatMap((id) => {
    const p = programById(id);
    return p ? [p] : [];
  });
  const providers = (providerIds ?? []).flatMap((id) => {
    const p = providerById(id);
    return p ? [p] : [];
  });

  return (
    <div className="space-y-6">
      <dl className="grid gap-3 @lg:grid-cols-2">
        {path.studyYears ? (
          <div>
            <dt className="text-sm text-muted-foreground">{t('studyYears')}</dt>
            <dd className="font-medium">{t('years', { count: path.studyYears })}</dd>
          </div>
        ) : null}
        {path.thanaweyaTracks?.length ? (
          <div>
            <dt className="text-sm text-muted-foreground">{t('tracks')}</dt>
            <dd className="font-medium">{path.thanaweyaTracks.map((tr) => t(`trackNames.${tr}`)).join(' / ')}</dd>
          </div>
        ) : null}
      </dl>

      {path.faculties?.length ? (
        <div className="space-y-2">
          <SubHeading>{t('faculties')}</SubHeading>
          <BulletList items={path.faculties} locale={locale} />
        </div>
      ) : null}

      {programs.length ? (
        <div className="space-y-3">
          <SubHeading>{t('programs')}</SubHeading>
          <ul className="grid gap-3 @2xl:grid-cols-2">
            {programs.map((p) => (
              <ProgramRow key={p.id} program={p} />
            ))}
          </ul>
        </div>
      ) : null}

      {path.tansikNote ? (
        <div className="space-y-2">
          <SubHeading>{t('tansik')}</SubHeading>
          <p className="text-sm">{pick(path.tansikNote, locale)}</p>
        </div>
      ) : null}

      {path.otherCurricula ? (
        <div className="space-y-2">
          <SubHeading>{t('otherCurricula')}</SubHeading>
          <p>{pick(path.otherCurricula, locale)}</p>
        </div>
      ) : null}

      {path.alternativeRoutes?.length ? (
        <div className="space-y-2">
          <SubHeading>{t('alternatives')}</SubHeading>
          <BulletList items={path.alternativeRoutes} locale={locale} />
        </div>
      ) : null}

      {path.licensing ? (
        <div className="space-y-2">
          <SubHeading>{t('licensing')}</SubHeading>
          <p>{pick(path.licensing, locale)}</p>
        </div>
      ) : null}

      {providers.length ? (
        <div className="space-y-3">
          <SubHeading>{t('providers')}</SubHeading>
          <ul className="grid gap-3 @2xl:grid-cols-2">
            {providers.map((p) => (
              <li key={p.id} className={`${cardClass} space-y-1`} data-testid="provider">
                <h4 className="font-semibold">{p.name[locale]}</h4>
                <p className="text-sm text-muted-foreground">{p.audience[locale]}</p>
                {p.website ? (
                  <p className="text-sm">
                    <a href={p.website} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      {t('website')}
                    </a>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
