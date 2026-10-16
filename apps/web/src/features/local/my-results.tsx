'use client';

import { careerById, clusters } from '@anabokra/content';
import type { Riasec } from '@anabokra/engine';
import { ChevronDown, ChevronRight, Clock, Coins, Mountain, Sparkles, Star } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { useNumberFormat } from '@/features/assessment/primitives';
import { useText } from '@/features/assessment/ui-context';
import { CareerTabs } from '@/features/careers/career-tabs';
import { LEVEL_TONE } from '@/features/careers/entry-section';
import { HeroCard, HeroPills, HeroText, PromptCard } from '@/features/journey/cards';
import { FeedbackForm } from '@/features/journey/feedback-form';
import { useJT } from '@/features/journey/use-jt';
import type { WorldProfile } from '@/features/path/types';
import { ProfileOverview } from '@/features/results/profile-overview';
import { ReadinessCheck, type ReadinessInstrument } from '@/features/results/readiness-check';
import { Reveal } from '@/features/results/reveal';
import type { MatchView, ResultView } from '@/features/results/view';
import { Link } from '@/i18n/navigation';
import { careerState } from '@/lib/journey/career-quest';
import type { JourneyData } from '@/lib/journey/journey';
import { nextStep, nextStepHref } from '@/lib/journey/next-step';
import { cn } from '@/lib/utils';
import type { CareerFacts } from '@/server/content/career-facts';

const ICON: Record<Riasec, string> = { R: '🔧', I: '🔬', A: '🎨', S: '🤝', E: '🚀', C: '🗂️' };

type Stage = 'reveal' | 'readiness' | 'main';

/**
 * My results (phase 1): the reveal on a fresh result, then one page in three tabs: careers that suit
 * me (each with pay, years of study and how hard it is to get in), who I am (interests, strengths,
 * values, abilities) and my journey (fields checked, careers tried, the next step). The readiness check
 * is offered as a short card instead of blocking the page.
 */
export function MyResults({
  data,
  view,
  worldProfile,
  facts,
  fresh,
  readinessDone,
  readiness,
  partial,
  after,
}: {
  data: JourneyData;
  view: ResultView;
  worldProfile: WorldProfile;
  facts: Record<string, CareerFacts>;
  fresh: boolean;
  readinessDone: boolean;
  readiness: ReadinessInstrument;
  partial: boolean;
  after?: ReactNode;
}) {
  const jt = useJT();
  const [stage, setStage] = useState<Stage>(fresh ? 'reveal' : 'main');
  const [done, setDone] = useState(readinessDone);
  const [askReadiness, setAskReadiness] = useState(false);

  if (stage === 'reveal') return <Reveal profile={worldProfile} onContinue={() => setStage(done ? 'main' : 'readiness')} />;
  if (stage === 'readiness' && !done)
    return (
      <ReadinessCheck
        sessionId={view.sessionId}
        instrument={readiness}
        onDone={() => (setDone(true), setStage('main'))}
        onSkip={() => setStage('main')}
      />
    );

  const tabs = [
    { id: 'careers', label: jt('results.tabs.careers'), content: <CareersTab data={data} view={view} facts={facts} /> },
    {
      id: 'me',
      label: jt('results.tabs.me'),
      content: (
        <div className="pt-2">
          <ProfileOverview view={view} summary={view.summary} partial={partial} showSummary={false} />
        </div>
      ),
    },
    { id: 'journey', label: jt('results.tabs.journey'), content: <JourneyTab data={data} after={after} onReplay={() => setStage('reveal')} /> },
  ];

  return (
    <div className="@container flex flex-col gap-5" data-testid="my-results">
      <Hero data={data} view={view} />
      {!done &&
        (askReadiness ? (
          <ReadinessCheck sessionId={view.sessionId} instrument={readiness} onDone={() => setDone(true)} onSkip={() => setAskReadiness(false)} />
        ) : (
          <PromptCard
            icon="⏱️"
            title={jt('results.readiness.title')}
            body={jt('results.readiness.body')}
            action={
              <Button size="sm" onClick={() => setAskReadiness(true)} data-testid="readiness-open">
                {jt('results.readiness.cta')}
              </Button>
            }
            testId="readiness-card"
          />
        ))}
      <CareerTabs facts={[]} factsLabel="" tabAction="results_tab" tabs={tabs} tabsLabel={jt('results.tabs.label')} stickyClass="top-[calc(max(env(safe-area-inset-top),0.75rem)+3.5rem)]" />
    </div>
  );
}

function Hero({ data, view }: { data: JourneyData; view: ResultView }) {
  const jt = useJT();
  const nf = useNumberFormat();
  const lead = view.types.slice(0, 2).map((t) => t.id);
  const checked = Object.values(data.journey.paths).filter((p) => p.result).length;
  const tried = Object.values(data.journey.careers ?? {}).filter((c) => c.result).length;
  const mine = data.journey.selectedCareers?.length ?? 0;
  const stats = [
    [checked, 'results.stats.fields'],
    [tried, 'results.stats.careers'],
    [mine, 'results.stats.mine'],
  ] as const;
  return (
    <HeroCard
      eyebrow={jt('results.eyebrow')}
      title={lead.length === 2 ? jt('compass.lead', { a: `${ICON[lead[0]!]} ${jt(`compass.types.${lead[0]}`)}`, b: `${ICON[lead[1]!]} ${jt(`compass.types.${lead[1]}`)}` }) : undefined}
      testId="results-hero"
    >
      {view.summary ? <HeroText>{view.summary}</HeroText> : null}
      <HeroPills items={stats.map(([n, key]) => n > 0 && jt(key, { count: n, n: nf.format(n) }))} />
    </HeroCard>
  );
}

function FactChips({ f }: { f: CareerFacts | undefined }) {
  const t = useTranslations('Careers');
  if (!f) return null;
  const k = (n: number) => Math.max(1, Math.round(n / 1000));
  return (
    <ul className="flex flex-wrap gap-1.5 text-xs font-semibold">
      {f.pay ? (
        <li className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
          <Coins className="size-3.5" aria-hidden />
          {t('facts.payRange', { min: k(f.pay.min), max: k(f.pay.max) })}
        </li>
      ) : null}
      {f.years ? (
        <li className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
          <Clock className="size-3.5" aria-hidden />
          {t('path.years', { count: f.years })}
        </li>
      ) : null}
      {f.entry ? (
        <li className={cn('flex items-center gap-1 rounded-full px-2.5 py-1', LEVEL_TONE[f.entry.level])} data-testid="match-entry">
          <Mountain className="size-3.5" aria-hidden />
          {t(`entry.levels.${f.entry.level}`)}
        </li>
      ) : null}
    </ul>
  );
}

/** One career that suits me: fit, the first reason, the practical facts, and the rest one tap away. */
function MatchRow({ m, data, facts, big = false }: { m: MatchView; data: JourneyData; facts: Record<string, CareerFacts>; big?: boolean }) {
  const jt = useJT();
  const nf = useNumberFormat();
  const career = careerById(m.careerId);
  const tx = useText();
  const checked = career ? Boolean(data.journey.paths[career.cluster]?.result) : false;
  const state = careerState(data.journey, m.careerId);
  const cautions = [...m.watchOuts, ...m.flags];
  return (
    <li className={cn('rounded-3xl border border-border bg-card shadow-sm', big ? 'p-4' : 'p-3')} data-testid="match-row">
      <div className="flex items-start gap-3">
        <span className={cn('grid shrink-0 place-items-center rounded-2xl font-bold tabular-nums', big ? 'size-14 bg-primary text-lg text-primary-foreground' : 'size-11 bg-secondary text-primary')} aria-label={jt('results.fit', { n: nf.format(m.fit) })}>
          {nf.format(m.fit)}%
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className={cn('font-bold leading-snug', big && 'text-lg')}>
            {state === 'selected' ? <Star className="me-1 inline size-4 fill-brand-orange-soft text-brand-orange" aria-hidden /> : null}
            <Link href={`/careers/${m.careerId}`} className="underline-offset-4 hover:text-primary hover:underline" data-testid="match-page">
              {m.name}
              <ChevronRight className="ms-0.5 inline size-4 text-primary rtl:rotate-180" aria-hidden />
            </Link>
          </p>
          <p className="text-xs text-muted-foreground">{m.cluster}</p>
          {big && m.reasons[0] ? <p className="text-sm leading-relaxed">{m.reasons[0]}</p> : null}
          <FactChips f={facts[m.careerId]} />
        </div>
      </div>
      {big && (m.reasons.length > 1 || cautions.length > 0) ? (
        <details className="group mt-1">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden">
            {jt('results.more')}
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          {m.reasons.length > 1 ? (
            <>
              <p className="mt-1 text-sm font-semibold">{jt('results.why')}</p>
              <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-muted-foreground">
                {m.reasons.slice(1, 3).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </>
          ) : null}
          {cautions.length > 0 ? (
            <>
              <p className="mt-2 text-sm font-semibold">{jt('results.watch')}</p>
              <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-muted-foreground">
                {cautions.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </>
          ) : null}
        </details>
      ) : null}
      {checked && career ? (
        <Link href={`/journey/${career.cluster}/${m.careerId}`} className="tap-link" data-testid="match-quest">
          {jt('careerPage.tryQuest', { career: tx(career.name) })}
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
      ) : null}
    </li>
  );
}

function CareersTab({ data, view, facts }: { data: JourneyData; view: ResultView; facts: Record<string, CareerFacts> }) {
  const jt = useJT();
  return (
    <div className="space-y-6 pt-2">
      <section className="space-y-3" aria-labelledby="top-h">
        <h2 id="top-h" className="text-xl font-bold">
          {jt('results.top')}
        </h2>
        <p className="text-sm text-muted-foreground">{jt('results.topIntro')}</p>
        <ol className="space-y-3">
          {view.top.map((m) => (
            <MatchRow key={m.careerId} m={m} data={data} facts={facts} big />
          ))}
        </ol>
      </section>
      {view.surprising.length > 0 && (
        <section className="space-y-3" aria-labelledby="sur-h">
          <h2 id="sur-h" className="flex items-center gap-2 text-lg font-bold">
            <Sparkles className="size-5 text-brand-orange" aria-hidden />
            {jt('results.surprising')}
          </h2>
          <ul className="space-y-2">
            {view.surprising.map((m) => (
              <MatchRow key={m.careerId} m={m} data={data} facts={facts} />
            ))}
          </ul>
        </section>
      )}
      {view.more.length > 0 && (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 font-bold text-primary [&::-webkit-details-marker]:hidden" data-testid="more-matches">
            {jt('results.moreMatches', { count: view.more.length })}
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="mt-2 space-y-2">
            {view.more.map((m) => (
              <MatchRow key={m.careerId} m={m} data={data} facts={facts} />
            ))}
          </ul>
        </details>
      )}
      <p className="text-xs text-muted-foreground">{jt('results.entryNote')}</p>
    </div>
  );
}

function JourneyTab({ data, after, onReplay }: { data: JourneyData; after?: ReactNode; onReplay: () => void }) {
  const jt = useJT();
  const nf = useNumberFormat();
  const locale = useLocale() as 'ar' | 'en';
  const step = useMemo(() => nextStep(data), [data]);
  const href = nextStepHref(step);
  const checked = Object.entries(data.journey.paths).filter(([, p]) => p.result);
  const tried = Object.entries(data.journey.careers ?? {}).filter(([, c]) => c.result);
  const fieldName = (id: string) => clusters.find((c) => c.id === id)?.name[locale] ?? id;
  return (
    <div className="space-y-6 pt-2">
      <PromptCard
        tone="lavender"
        icon="🧭"
        title={jt('results.next')}
        body={
          step.kind === 'task'
            ? `${jt('task', { n: nf.format(step.n) })} · ${jt(`taskTitles.${step.n}`)}`
            : step.kind === 'field'
              ? jt('map.next.field', { field: fieldName(step.id) })
              : step.kind === 'career'
                ? (careerById(step.id)?.name[locale] ?? step.id)
                : jt('map.next.explore')
        }
        action={
          <Button asChild size="sm">
            <Link href={href ?? '/journey?view=list'}>
              {jt('map.next.continue')}
              <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
        }
        testId="results-next"
      />

      <section className="space-y-2" aria-labelledby="fields-h">
        <h2 id="fields-h" className="text-lg font-bold">
          {jt('results.fieldsTitle')}
        </h2>
        {checked.length ? (
          <ul className="space-y-2">
            {checked.map(([id, p]) => (
              <li key={id}>
                <Link href={`/journey/${id}`} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm hover:shadow-md">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{fieldName(id)}</span>
                    <span className="block text-xs text-muted-foreground">{jt(`verify.bands.${p.result!.band}`)}</span>
                  </span>
                  <span className="text-sm font-bold tabular-nums text-primary">{nf.format(Math.round(p.result!.fit * 100))}%</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{jt('results.noFields')}</p>
        )}
      </section>

      {tried.length > 0 && (
        <section className="space-y-2" aria-labelledby="tried-h">
          <h2 id="tried-h" className="text-lg font-bold">
            {jt('results.triedTitle')}
          </h2>
          <ul className="space-y-2">
            {tried.map(([id, c]) => {
              const career = careerById(id);
              const mine = data.journey.selectedCareers?.includes(id);
              return (
                <li key={id}>
                  <Link href={career ? `/journey/${career.cluster}/${id}` : `/careers/${id}`} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm hover:shadow-md">
                    {mine ? <Star className="size-5 shrink-0 fill-brand-orange-soft text-brand-orange" aria-label={jt('career.isMine')} /> : null}
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{career?.name[locale] ?? id}</span>
                      <span className="block text-xs text-muted-foreground">{jt(`career.bands.${c.result!.band}`)}</span>
                    </span>
                    <span className="text-sm font-bold tabular-nums text-primary">{nf.format(Math.round(c.result!.fit * 100))}%</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {after}
      <ResultsFeedback data={data} />
      <Button type="button" variant="ghost" onClick={onReplay} data-testid="replay-reveal">
        {jt('results.replay')}
      </Button>
    </div>
  );
}

/** "Your opinion matters": the feedback form, opened from a prompt so it doesn't crowd the tab. */
function ResultsFeedback({ data }: { data: JourneyData }) {
  const jt = useJT();
  const [open, setOpen] = useState(false);
  if (open) return <FeedbackForm rt={data.rt} screen="results" />;
  return (
    <PromptCard
      tone="lavender"
      icon="💬"
      title={jt('feedback.promptTitle')}
      body={jt('feedback.promptBody')}
      action={
        <Button size="sm" onClick={() => setOpen(true)} data-testid="feedback-open">
          {jt('feedback.promptCta')}
        </Button>
      }
      testId="feedback-prompt"
    />
  );
}
