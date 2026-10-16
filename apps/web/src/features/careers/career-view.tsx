import { careerById, type Bilingual, type Career, type Cluster, type Industry } from '@anabokra/content';
import { Check, ChevronDown, CircleAlert, Sun } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { pathArt } from '@/features/art/task-art';
import { TaskArt } from '@/features/art/task-art-view';
import { CareerPageFit } from '@/features/journey/career-page-fit';
import { HeroCard, HeroPills, PromptCard } from '@/features/journey/cards';
import { PageFeedback } from '@/features/journey/feedback-form';
import { Link } from '@/i18n/navigation';
import { DATA_MODE } from '@/lib/data-mode';
import { SUPPORT_EMAIL } from '@/lib/site';

import { CareerTabs, type CareerTab, type QuickFact } from './career-tabs';
import { salarySpan } from './catalog';
import { entryOf } from './entry';
import { EntrySection } from './entry-section';
import { pick, Section, SubHeading } from './common';
import { FavoriteButton } from './favorite-button';
import { FitPanel } from './fit-panel';
import { OutlookSection } from './outlook-section';
import { PathSection } from './path-section';
import { MarketSection } from './salary';
import { ShareButton } from './share-button';
import { cardClass, chipClass, linkClass } from './ui';
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
   * Inside the phase 1 app shell: its sticky top bar sits above the tab bar, its back link replaces the
   * link to the career list, and the page ends with a step back into the journey.
   */
  framed?: boolean;
}

/** Short items (skills, places, tools) read faster as chips than as a bullet list. */
function Chips({ items, locale }: { items: Bilingual[] | undefined; locale: Locale }) {
  if (!items?.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((it, i) => (
        <li key={i} className="rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary-foreground">
          {it[locale]}
        </li>
      ))}
    </ul>
  );
}

/** A list where every line starts with the same small icon. */
function IconList({ items, locale, icon }: { items: Bilingual[] | undefined; locale: Locale; icon: ReactNode }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0">{icon}</span>
          <span>{it[locale]}</span>
        </li>
      ))}
    </ul>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <SubHeading>{title}</SubHeading>
      {children}
    </div>
  );
}

/**
 * F2 body: a header with the four facts students ask first (pay, study, demand, future), then the page in
 * four tabs. Every block renders only when its data exists, so lite pages degrade to what they have.
 */
export function CareerView({ career, cluster, page, industry, path, framed = false }: CareerViewProps) {
  const t = useTranslations('Careers');
  const locale = useLocale() as Locale;
  const name = career.name[locale];
  const full = page?.depth === 'full';
  // Favorites, fit and compare need an account (phase 2); phase 1 keeps everything on the phone.
  const server = DATA_MODE === 'server';

  const related = (page?.progression?.relatedCareerIds ?? []).flatMap((id) => {
    const c = careerById(id);
    return c ? [c] : [];
  });
  const reportHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`${t('report.subject')}: ${career.id}`)}&body=${encodeURIComponent(path)}`;

  // ---- the four facts ----
  const span = salarySpan(page);
  const k = (n: number) => Math.max(1, Math.round(n / 1000));
  const p = page?.pathEgypt;
  const facts: QuickFact[] = [];
  if (page?.marketEgypt)
    facts.push({ icon: 'pay', label: t('facts.pay'), value: span ? t('facts.payRange', { min: k(span.min), max: k(span.max) }) : t('facts.payNone'), sub: span ? t('facts.perMonth') : undefined, tab: 'money' });
  if (p)
    facts.push({
      icon: 'study',
      label: t('facts.study'),
      value: p.studyYears ? t('path.years', { count: p.studyYears }) : t('facts.studyVaries'),
      sub: p.thanaweyaTracks?.length ? p.thanaweyaTracks.map((tr) => t(`tracks.${tr}`)).join(' · ') : undefined,
      tab: 'path',
    });
  if (page?.marketEgypt?.demand) facts.push({ icon: 'demand', label: t('facts.demand'), value: t(`market.demandLevels.${page.marketEgypt.demand}`), tab: 'money' });
  if (industry) facts.push({ icon: 'future', label: t('facts.future'), value: t(`trend.${industry.outlook.trend}`), tab: 'money' });
  const entry = entryOf(page);
  if (entry) facts.push({ icon: 'entry', label: t('facts.entry'), value: t(`entry.levels.${entry.level}`), sub: t('facts.entrySub', { count: entry.hurdles.length }), tab: 'path', wide: true });

  // ---- tab: the job ----
  const job = (
    <Section id="overview" title={t('sections.overview')}>
      {page?.snapshot?.summary ? <p className="max-w-prose leading-relaxed">{pick(page.snapshot.summary, locale)}</p> : null}
      {!page?.snapshot && !page?.whatYouDo ? <p className="text-muted-foreground">{t('page.overviewEmpty')}</p> : null}
      {page?.snapshot?.dayInLife ? (
        <div className="space-y-2 rounded-3xl bg-accent p-4">
          <h3 className="flex items-center gap-2 font-bold text-accent-foreground">
            <Sun className="size-5 text-brand-orange" aria-hidden />
            {t('overview.dayInLife')}
          </h3>
          <p className="max-w-prose leading-relaxed">{pick(page.snapshot.dayInLife, locale)}</p>
        </div>
      ) : null}
      {page?.whatYouDo?.tasks?.length ? (
        <Block title={t('overview.tasks')}>
          <IconList items={page.whatYouDo.tasks} locale={locale} icon={<Check className="size-5 text-brand-success" aria-hidden />} />
        </Block>
      ) : null}
      {page?.whatYouDo?.environments?.length ? (
        <Block title={t('overview.environments')}>
          <Chips items={page.whatYouDo.environments} locale={locale} />
        </Block>
      ) : null}
      {page?.whatYouDo?.tools?.length ? (
        <Block title={t('overview.tools')}>
          <Chips items={page.whatYouDo.tools} locale={locale} />
        </Block>
      ) : null}
    </Section>
  );

  // ---- tab: getting there ----
  const skills = page?.skills;
  const getThere = (
    <>
      {entry ? (
        <Section id="entry" title={t('sections.entry')}>
          <EntrySection entry={entry} personal={framed} />
        </Section>
      ) : null}
      {page?.pathEgypt ? (
        <Section id="path" title={t('sections.path')}>
          <PathSection path={page.pathEgypt} providerIds={page.marketEgypt?.providerIds} />
        </Section>
      ) : null}
      {skills ? (
        <Section id="skills" title={t('sections.skills')}>
          {skills.hard?.length ? (
            <Block title={t('skills.hard')}>
              <Chips items={skills.hard} locale={locale} />
            </Block>
          ) : null}
          {skills.soft?.length ? (
            <Block title={t('skills.soft')}>
              <Chips items={skills.soft} locale={locale} />
            </Block>
          ) : null}
          {skills.languages?.length ? (
            <Block title={t('skills.languages')}>
              <Chips items={skills.languages} locale={locale} />
            </Block>
          ) : null}
          {skills.certifications?.length ? (
            <Block title={t('skills.certifications')}>
              <IconList items={skills.certifications} locale={locale} icon={<Check className="size-5 text-primary" aria-hidden />} />
            </Block>
          ) : null}
          {skills.starterResources?.length ? (
            <Block title={t('skills.starter')}>
              <ul className="space-y-2">
                {skills.starterResources.map((r) => (
                  <li key={r.url}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      {r.title}
                    </a>
                    {r.free ? <span className="ms-2 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{t('skills.free')}</span> : null}
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}
        </Section>
      ) : null}
    </>
  );

  // ---- tab: pay and future ----
  const money = (
    <>
      {page?.marketEgypt || page?.global ? (
        <Section id="market" title={t('sections.market')}>
          {page?.marketEgypt ? <MarketSection market={page.marketEgypt} /> : null}
          {page?.global ? (
            <Block title={t('market.global')}>
              <p className="max-w-prose">{pick(page.global, locale)}</p>
            </Block>
          ) : null}
        </Section>
      ) : null}
      {industry ? (
        <Section id="future" title={t('sections.future')}>
          <OutlookSection industry={industry} showSources={false} />
        </Section>
      ) : null}
    </>
  );

  // ---- tab: real talk ----
  const reality = page?.reality;
  const ladder = page?.progression?.ladder ?? [];
  const hasRelated = Boolean(ladder.length || related.length || page?.progression?.pivots?.length);
  const real = (
    <>
      {reality ? (
        <Section id="reality" title={t('sections.reality')}>
          <div className="grid gap-3 @2xl:grid-cols-2">
            {reality.pros?.length ? (
              <div className={`${cardClass} space-y-3`}>
                <SubHeading>{t('reality.pros')}</SubHeading>
                <IconList items={reality.pros} locale={locale} icon={<Check className="size-5 text-brand-success" aria-hidden />} />
              </div>
            ) : null}
            {reality.challenges?.length ? (
              <div className={`${cardClass} space-y-3`}>
                <SubHeading>{t('reality.challenges')}</SubHeading>
                <IconList items={reality.challenges} locale={locale} icon={<CircleAlert className="size-5 text-brand-orange" aria-hidden />} />
              </div>
            ) : null}
          </div>
          {reality.myths?.length ? (
            <Block title={t('reality.myths')}>
              <p className="text-sm text-muted-foreground">{t('reality.mythsHint')}</p>
              <ul className="space-y-3">
                {reality.myths.map((m, i) => (
                  <li key={i}>
                    <details className="group rounded-2xl border border-border bg-card shadow-sm" data-testid="myth">
                      <summary className="flex min-h-11 cursor-pointer list-none items-start gap-3 p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                        <span className="flex-1">
                          <span className="block text-xs font-semibold text-muted-foreground">{t('reality.myth')}</span>
                          <span className="font-medium">{m.myth[locale]}</span>
                        </span>
                        <ChevronDown className="mt-1 size-5 shrink-0 text-primary transition-transform group-open:rotate-180" aria-hidden />
                      </summary>
                      <p className="mx-4 mb-4 rounded-xl bg-secondary p-3 text-secondary-foreground">
                        <span className="block text-xs font-semibold">{t('reality.fact')}</span>
                        {m.fact[locale]}
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}
          {reality.workLifeBalance ? (
            <Block title={t('reality.balance')}>
              <p className="max-w-prose">{pick(reality.workLifeBalance, locale)}</p>
            </Block>
          ) : null}
        </Section>
      ) : null}
      {hasRelated ? (
        <Section id="related" title={t('sections.related')}>
          {ladder.length ? (
            <Block title={t('related.ladder')}>
              <ol className="space-y-0">
                {ladder.map((s, i) => (
                  <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < ladder.length - 1 ? <span aria-hidden className="absolute start-[0.9rem] top-8 h-[calc(100%-2rem)] w-0.5 bg-border" /> : null}
                    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-bold text-primary">
                      {new Intl.NumberFormat(locale).format(i + 1)}
                    </span>
                    <span className="pt-1">{s[locale]}</span>
                  </li>
                ))}
              </ol>
            </Block>
          ) : null}
          {related.length ? (
            <Block title={t('related.careers')}>
              <ul className="flex flex-wrap gap-2">
                {related.map((c) => (
                  <li key={c.id}>
                    <Link href={`/careers/${c.id}`} className={chipClass}>
                      {c.name[locale]}
                    </Link>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}
          {page?.progression?.pivots?.length ? (
            <Block title={t('related.pivots')}>
              <Chips items={page.progression.pivots} locale={locale} />
            </Block>
          ) : null}
        </Section>
      ) : null}
    </>
  );

  const tabs: CareerTab[] = (
    [
      ['job', job, true],
      ['path', getThere, Boolean(entry || page?.pathEgypt || skills)],
      ['money', money, Boolean(page?.marketEgypt || page?.global || industry)],
      ['real', real, Boolean(reality || hasRelated)],
    ] as const
  ).flatMap(([id, content, show]) => (show ? [{ id, label: t(`tabs.${id}`), content }] : []));

  const sources = page?.sources ?? [];
  const outlookSources = industry?.sources ?? [];

  return (
    <article className="@container space-y-6">
      <header className="space-y-4">
        {!framed && (
          <Link href="/careers" className={linkClass}>
            {t('page.back')}
          </Link>
        )}
        {/* A scene from the career's field (decorative); newer fields show the drawn placeholder. */}
        <HeroCard
          art={<TaskArt chain={pathArt(career.cluster, 'day')} className="absolute inset-0" />}
          eyebrow={cluster?.name[locale]}
          title={name}
          titleAs="h1"
          testId="career-hero"
        >
          {page?.snapshot?.hook ? <p className="max-w-prose text-lg font-medium leading-snug">{pick(page.snapshot.hook, locale)}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <HeroPills items={[career.hollandCode ? `${t('page.workStyle')}: ${[...career.hollandCode].map((l) => t(`riasec.${l}`)).join(' · ')}` : null]} />
            <div className="flex items-center gap-2">
              {server && <FavoriteButton careerId={career.id} name={name} nextPath={path} />}
              <ShareButton title={name} compact />
            </div>
          </div>
        </HeroCard>
        {server && (
          <Link href={`/careers/compare?ids=${career.id}`} className={`${linkClass} text-sm`}>
            {t('page.compare')}
          </Link>
        )}
        {server ? <FitPanel careerId={career.id} /> : <CareerPageFit careerId={career.id} />}
        {!full ? (
          <p role="note" className="rounded-2xl border border-dashed bg-accent/40 p-3 text-sm" data-testid="lite-note">
            {t(page ? 'page.liteNote' : 'page.noPageNote')}
          </p>
        ) : null}
      </header>

      <CareerTabs
        facts={facts}
        factsLabel={t('facts.label')}
        tabs={tabs}
        tabsLabel={t('page.sections')}
        careerId={career.id}
        stickyClass={framed ? 'top-[calc(max(env(safe-area-inset-top),0.75rem)+3.5rem)]' : 'top-0'}
      />

      {framed && cluster ? (
        <PromptCard tone="lavender" icon="🏝️" title={t('next.title')} body={t('next.body', { field: cluster.name[locale] })} testId="career-next">
          <Link href={`/journey/${cluster.id}`} className="inline-flex min-h-11 items-center self-start rounded-full bg-primary px-5 font-semibold text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {t('next.cta')}
          </Link>
        </PromptCard>
      ) : null}

      {framed ? <PageFeedback career={career.id} /> : null}

      <section id="sources" aria-labelledby="sources-title" className="space-y-3 border-t pt-4">
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <h2 id="sources-title" className="text-base font-bold">
              {t('sections.sources')}
            </h2>
            <span className="text-sm text-muted-foreground">{t('page.sourcesCount', { count: sources.length + outlookSources.length })}</span>
            <ChevronDown className="ms-auto size-5 text-primary transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="space-y-4 pt-2">
            {sources.length ? (
              <ul className="list-disc space-y-1 ps-5 text-sm">
                {sources.map((s) => (
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
            {outlookSources.length ? (
              <div className="space-y-1">
                <SubHeading>{t('future.sources')}</SubHeading>
                <ul className="list-disc space-y-1 ps-5 text-sm">
                  {outlookSources.map((s) => (
                    <li key={s.id}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                        {s.title}
                      </a>
                      {s.publisher ? <span className="text-muted-foreground"> - {s.publisher}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
        <p className="text-sm text-muted-foreground">
          {page?.lastReviewedAt ? t('page.lastReviewed', { date: new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(page.lastReviewedAt)) }) : t('page.notReviewed')}
          {page?.status === 'draft' ? ` ${t('page.draft')}` : ''}
        </p>
        <p className="text-sm">
          <a href={reportHref} className={linkClass}>
            {t('report.link')}
          </a>
        </p>
      </section>
    </article>
  );
}
