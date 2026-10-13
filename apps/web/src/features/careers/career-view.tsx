import { careerById, type Career, type Cluster, type Industry } from '@anabokra/content';
import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { DATA_MODE } from '@/lib/data-mode';
import { SUPPORT_EMAIL } from '@/lib/site';

import { BulletList, pick, Section, SubHeading } from './common';
import { FavoriteButton } from './favorite-button';
import { FitPanel } from './fit-panel';
import { OutlookSection } from './outlook-section';
import { PathSection } from './path-section';
import { MarketSection } from './salary';
import { ShareButton } from './share-button';
import { badgeClass, cardClass, chipClass, linkClass } from './ui';
import type { CareerPage, Locale } from './types';


export interface CareerViewProps {
  career: Career;
  cluster: Cluster | undefined;
  /** Undefined while the career has no authored page yet. */
  page: CareerPage | undefined;
  industry: Industry | undefined;
  /** Public path of this page without locale, for the sign-in return and the report link. */
  path: string;
  /**
   * Inside the phase 1 app shell: its sticky top bar sits above the section chips, and its back link
   * replaces the link to the career list.
   */
  framed?: boolean;
}

/** F2 body: every section is rendered only when its data exists, so lite pages degrade to what they have. */
export function CareerView({ career, cluster, page, industry, path, framed = false }: CareerViewProps) {
  const t = useTranslations('Careers');
  const locale = useLocale() as Locale;
  const name = career.name[locale];
  const full = page?.depth === 'full';
  // Favorites, fit and compare need an account (phase 2); phase 1 keeps everything on the phone.
  const server = DATA_MODE === 'server';

  const hasOverview = Boolean(page?.snapshot || page?.whatYouDo);
  const hasMarket = Boolean(page?.marketEgypt || page?.global);
  const hasReality = Boolean(page?.reality);
  const hasRelated = Boolean(page?.progression && (page.progression.ladder?.length || page.progression.relatedCareerIds?.length || page.progression.pivots?.length));
  const nav = [
    { id: 'overview', show: true },
    { id: 'path', show: Boolean(page?.pathEgypt) },
    { id: 'skills', show: Boolean(page?.skills) },
    { id: 'market', show: hasMarket },
    { id: 'future', show: Boolean(industry) },
    { id: 'reality', show: hasReality },
    { id: 'related', show: hasRelated },
    { id: 'sources', show: true },
  ].filter((n) => n.show);

  const related = (page?.progression?.relatedCareerIds ?? []).flatMap((id) => {
    const c = careerById(id);
    return c ? [c] : [];
  });
  const reportHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`${t('report.subject')}: ${career.id}`)}&body=${encodeURIComponent(path)}`;

  return (
    <article className="@container space-y-8">
      <header className="space-y-4">
        {!framed && (
          <Link href="/careers" className={linkClass}>
            {t('page.back')}
          </Link>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold leading-tight">{name}</h1>
            <ul className="flex flex-wrap gap-2" aria-label={t('card.facts')}>
              {cluster ? <li className={badgeClass}>{cluster.name[locale]}</li> : null}
              <li className={badgeClass}>
                <span className="sr-only">{t('card.holland')}: </span>
                <span dir="ltr">{career.hollandCode}</span>
              </li>
              {industry ? (
                <li className={badgeClass}>
                  {t('card.outlook')}: {t(`trend.${industry.outlook.trend}`)}
                </li>
              ) : null}
            </ul>
            {page?.snapshot?.hook ? <p className="max-w-prose text-lg text-muted-foreground">{pick(page.snapshot.hook, locale)}</p> : null}
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {server && <FavoriteButton careerId={career.id} name={name} nextPath={path} />}
            <ShareButton title={name} />
            {server && (
              <Link href={`/careers/compare?ids=${career.id}`} className={`${linkClass} self-center text-sm`}>
                {t('page.compare')}
              </Link>
            )}
          </div>
        </div>
        {server && <FitPanel careerId={career.id} />}
        {!full ? (
          <p role="note" className="rounded-2xl border border-dashed bg-accent/40 p-3 text-sm" data-testid="lite-note">
            {t(page ? 'page.liteNote' : 'page.noPageNote')}
          </p>
        ) : null}
      </header>

      <nav
        aria-label={t('page.sections')}
        className={`sticky z-10 -mx-1 overflow-x-auto bg-background/95 px-1 py-2 backdrop-blur ${framed ? 'top-[calc(max(env(safe-area-inset-top),0.75rem)+3.5rem)]' : 'top-0'}`}
      >
        <ul className="flex gap-2 whitespace-nowrap">
          {nav.map((n) => (
            <li key={n.id}>
              <a href={`#${n.id}`} className={chipClass}>
                {t(`sections.${n.id}`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="overview" title={t('sections.overview')}>
        {page?.snapshot?.summary ? <p className="max-w-prose">{pick(page.snapshot.summary, locale)}</p> : null}
        {!hasOverview ? <p className="text-muted-foreground">{t('page.overviewEmpty')}</p> : null}
        {page?.snapshot?.dayInLife ? (
          <div className="space-y-1">
            <SubHeading>{t('overview.dayInLife')}</SubHeading>
            <p className="max-w-prose">{pick(page.snapshot.dayInLife, locale)}</p>
          </div>
        ) : null}
        {page?.whatYouDo?.tasks?.length ? (
          <div className="space-y-1">
            <SubHeading>{t('overview.tasks')}</SubHeading>
            <BulletList items={page.whatYouDo.tasks} locale={locale} />
          </div>
        ) : null}
        {page?.whatYouDo?.environments?.length ? (
          <div className="space-y-1">
            <SubHeading>{t('overview.environments')}</SubHeading>
            <BulletList items={page.whatYouDo.environments} locale={locale} />
          </div>
        ) : null}
        {page?.whatYouDo?.tools?.length ? (
          <div className="space-y-1">
            <SubHeading>{t('overview.tools')}</SubHeading>
            <BulletList items={page.whatYouDo.tools} locale={locale} />
          </div>
        ) : null}
      </Section>

      {page?.pathEgypt ? (
        <Section id="path" title={t('sections.path')}>
          <PathSection path={page.pathEgypt} providerIds={page.marketEgypt?.providerIds} />
        </Section>
      ) : null}

      {page?.skills ? (
        <Section id="skills" title={t('sections.skills')}>
          {(
            [
              ['hard', page.skills.hard],
              ['soft', page.skills.soft],
              ['languages', page.skills.languages],
              ['certifications', page.skills.certifications],
            ] as const
          ).map(([key, items]) =>
            items?.length ? (
              <div key={key} className="space-y-1">
                <SubHeading>{t(`skills.${key}`)}</SubHeading>
                <BulletList items={items} locale={locale} />
              </div>
            ) : null,
          )}
          {page.skills.starterResources?.length ? (
            <div className="space-y-1">
              <SubHeading>{t('skills.starter')}</SubHeading>
              <ul className="list-disc space-y-1 ps-5">
                {page.skills.starterResources.map((r) => (
                  <li key={r.url}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      {r.title}
                    </a>
                    {r.free ? <span className="text-sm text-muted-foreground"> ({t('skills.free')})</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>
      ) : null}

      {hasMarket ? (
        <Section id="market" title={t('sections.market')}>
          {page?.marketEgypt ? <MarketSection market={page.marketEgypt} /> : null}
          {page?.global ? (
            <div className="space-y-1">
              <SubHeading>{t('market.global')}</SubHeading>
              <p className="max-w-prose">{pick(page.global, locale)}</p>
            </div>
          ) : null}
        </Section>
      ) : null}

      {industry ? (
        <Section id="future" title={t('sections.future')}>
          <OutlookSection industry={industry} />
        </Section>
      ) : null}

      {page?.reality ? (
        <Section id="reality" title={t('sections.reality')}>
          <div className="grid gap-4 @2xl:grid-cols-2">
            {page.reality.pros?.length ? (
              <div className={`${cardClass} space-y-2`}>
                <SubHeading>{t('reality.pros')}</SubHeading>
                <BulletList items={page.reality.pros} locale={locale} />
              </div>
            ) : null}
            {page.reality.challenges?.length ? (
              <div className={`${cardClass} space-y-2`}>
                <SubHeading>{t('reality.challenges')}</SubHeading>
                <BulletList items={page.reality.challenges} locale={locale} />
              </div>
            ) : null}
          </div>
          {page.reality.myths?.length ? (
            <div className="space-y-2">
              <SubHeading>{t('reality.myths')}</SubHeading>
              <ul className="space-y-3">
                {page.reality.myths.map((m, i) => (
                  <li key={i} className={`${cardClass} space-y-1`}>
                    <p>
                      <span className="font-medium">{t('reality.myth')}: </span>
                      {m.myth[locale]}
                    </p>
                    <p>
                      <span className="font-medium">{t('reality.fact')}: </span>
                      {m.fact[locale]}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {page.reality.workLifeBalance ? (
            <div className="space-y-1">
              <SubHeading>{t('reality.balance')}</SubHeading>
              <p className="max-w-prose">{pick(page.reality.workLifeBalance, locale)}</p>
            </div>
          ) : null}
        </Section>
      ) : null}

      {hasRelated && page?.progression ? (
        <Section id="related" title={t('sections.related')}>
          {page.progression.ladder?.length ? (
            <div className="space-y-1">
              <SubHeading>{t('related.ladder')}</SubHeading>
              <ol className="list-decimal space-y-1 ps-5">
                {page.progression.ladder.map((s, i) => (
                  <li key={i}>{s[locale]}</li>
                ))}
              </ol>
            </div>
          ) : null}
          {related.length ? (
            <div className="space-y-2">
              <SubHeading>{t('related.careers')}</SubHeading>
              <ul className="flex flex-wrap gap-2">
                {related.map((c) => (
                  <li key={c.id}>
                    <Link href={`/careers/${c.id}`} className={chipClass}>
                      {c.name[locale]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {page.progression.pivots?.length ? (
            <div className="space-y-1">
              <SubHeading>{t('related.pivots')}</SubHeading>
              <BulletList items={page.progression.pivots} locale={locale} />
            </div>
          ) : null}
        </Section>
      ) : null}

      <Section id="sources" title={t('sections.sources')}>
        {page?.sources?.length ? (
          <ul className="list-disc space-y-1 ps-5 text-sm">
            {page.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('page.noSources')}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {page?.lastReviewedAt ? t('page.lastReviewed', { date: new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(page.lastReviewedAt)) }) : t('page.notReviewed')}
          {page?.status === 'draft' ? ` ${t('page.draft')}` : ''}
        </p>
        <p>
          <a href={reportHref} className={linkClass}>
            {t('report.link')}
          </a>
        </p>
      </Section>
    </article>
  );
}
