'use client';

import { careerById, clusters } from '@anabokra/content';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';

import { useNumberFormat } from '@/features/assessment/primitives';
import { AssessmentProvider, useText } from '@/features/assessment/ui-context';
import type { Locale } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { careerUnlocked } from '@/lib/journey/career-quest';
import { loadJourney, type JourneyData } from '@/lib/journey/journey';
import { bandFor, type VerifyBand } from '@/lib/journey/verify';
import { cn } from '@/lib/utils';

import { BAND_TONE, HeroCard } from './cards';
import { useJT } from './use-jt';

/** What the phone knows about this career for this user, most specific first. */
export type CareerFit =
  | { kind: 'quest'; fit: number; band: VerifyBand }
  | { kind: 'path'; fit: number; band: VerifyBand; unlocked: true }
  | { kind: 'discover'; match: number }
  | { kind: 'none' };

/** Pure: picks the best evidence for one career from the journey (quest, then field check, then Discover). */
export function careerFit(data: Pick<JourneyData, 'journey' | 'preview' | 'discover'>, careerId: string): CareerFit {
  const career = careerById(careerId);
  if (!career) return { kind: 'none' };
  const quest = data.journey.careers?.[careerId]?.result;
  if (quest) return { kind: 'quest', fit: quest.fit, band: quest.band };
  const path = data.journey.paths[career.cluster]?.result?.careers.find((c) => c.careerId === careerId);
  if (path && careerUnlocked(data.journey, careerId)) return { kind: 'path', fit: path.fit, band: bandFor(path.fit), unlocked: true };
  const match = data.preview.fits[careerId];
  if (data.discover.next === null && match !== undefined) return { kind: 'discover', match };
  return { kind: 'none' };
}


/**
 * "How this career fits you" on the career page (phase 1, on the phone). Shows the latest evidence and the
 * next step: the career quest once the field is checked, otherwise the field island or Discover. Renders
 * nothing when the app is not set up or is locked, so the public page is never blocked.
 */
export function CareerPageFit({ careerId }: { careerId: string }) {
  const locale = useLocale() as Locale;
  const [data, setData] = useState<JourneyData | null>(null);

  useEffect(() => {
    let alive = true;
    void loadJourney(locale)
      .then((s) => {
        if (alive && s.kind === 'ready') setData(s);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [locale]);

  if (!data) return null;
  return (
    <AssessmentProvider gender={data.rt.profile.gender}>
      <FitCard careerId={careerId} fit={careerFit(data, careerId)} />
    </AssessmentProvider>
  );
}

export function FitCard({ careerId, fit }: { careerId: string; fit: CareerFit }) {
  const jt = useJT();
  const tx = useText();
  const nf = useNumberFormat();
  const career = careerById(careerId)!;
  const field = tx(clusters.find((c) => c.id === career.cluster)?.name ?? { en: career.cluster, ar: career.cluster });
  const name = tx(career.name);
  const pct = (x: number) => `${nf.format(Math.round(x * 100))}%`;

  const action = (href: string, label: string) => (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      data-testid="fit-action"
    >
      {label}
      <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
    </Link>
  );

  let body;
  if (fit.kind === 'quest' || fit.kind === 'path') {
    body = (
      <>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-3xl font-bold tabular-nums">{pct(fit.fit)}</span>
          <span className={cn('rounded-full bg-white/70 px-3 py-1 text-sm font-semibold')}>{jt(`career.bands.${fit.band}`)}</span>
        </div>
        <p className="text-sm opacity-80">{jt(fit.kind === 'quest' ? 'careerPage.fromQuest' : 'careerPage.fromPath', { field })}</p>
        {fit.kind === 'quest'
          ? action(`/journey/${career.cluster}/${careerId}`, jt('careerPage.seeResult'))
          : action(`/journey/${career.cluster}/${careerId}`, jt('careerPage.tryQuest', { career: name }))}
      </>
    );
  } else if (fit.kind === 'discover') {
    body = (
      <>
        <span className="text-3xl font-bold tabular-nums">{nf.format(Math.round(fit.match))}%</span>
        <p className="text-sm opacity-80">{jt('careerPage.fromDiscover')}</p>
        {action(`/journey/${career.cluster}`, jt('careerPage.checkField', { field }))}
      </>
    );
  } else {
    body = (
      <>
        <p>{jt('careerPage.noneYet')}</p>
        {action('/journey/me', jt('careerPage.findFit'))}
      </>
    );
  }

  return (
    <div data-kind={fit.kind}>
      <HeroCard
        tone={fit.kind === 'quest' || fit.kind === 'path' ? BAND_TONE[fit.band] : 'lavender'}
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-4" aria-hidden />
            {jt('careerPage.title')}
          </span>
        }
        testId="career-fit"
      >
        {body}
      </HeroCard>
    </div>
  );
}
