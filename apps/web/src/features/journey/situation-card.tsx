'use client';

import { HandHeart, Lock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { AssessmentProvider } from '@/features/assessment/ui-context';
import type { Locale } from '@/i18n/routing';
import { loadJourney, type JourneyData } from '@/lib/journey/journey';
import { affecting, BUDGETS, REGIONS, saveSituation, type Budget, type Region, type Situation } from '@/lib/journey/situation';
import { cn } from '@/lib/utils';

import { useJT } from './use-jt';

type Hurdles = readonly { kind: string; level: number }[];

/**
 * "Your circumstances matter": three optional questions (budget, where you live, working while
 * studying) that mark which of a career's hurdles weigh more for this user. Answers stay on the device.
 * Renders nothing when the app is not set up or is locked. Without `hurdles` it is the settings form.
 */
export function SituationCard({ hurdles }: { hurdles?: Hurdles }) {
  const locale = useLocale() as Locale;
  const [data, setData] = useState<JourneyData | null>(null);
  const [version, setVersion] = useState(0);

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
  }, [locale, version]);

  if (!data) return null;
  return (
    <AssessmentProvider gender={data.rt.profile.gender}>
      <SituationView
        situation={data.journey.situation}
        hurdles={hurdles}
        onSave={async (s) => {
          await saveSituation(data.rt.device.kv, data.rt.userId, s);
          setVersion((v) => v + 1);
        }}
      />
    </AssessmentProvider>
  );
}

export function SituationView({ situation, hurdles, onSave }: { situation: Situation | undefined; hurdles?: Hurdles; onSave: (s: Omit<Situation, 'at'> | null) => Promise<void> }) {
  const jt = useJT();
  const sep = useLocale() === 'ar' ? '، ' : ', ';
  const t = useTranslations('Careers.entry');
  const [editing, setEditing] = useState(false);
  const [budget, setBudget] = useState<Budget | undefined>(situation?.budget);
  const [region, setRegion] = useState<Region | undefined>(situation?.region);
  const [work, setWork] = useState<boolean | undefined>(situation?.work);

  const chip = (on: boolean) =>
    cn('min-h-11 rounded-full border px-4 text-sm font-medium transition-colors', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary');

  if (editing)
    return (
      <section className="space-y-4 rounded-3xl border-2 border-brand-lavender bg-card p-4" data-testid="situation-form">
        <fieldset className="space-y-2">
          <legend className="font-semibold">{jt('situation.budget.q')}</legend>
          <div className="flex flex-wrap gap-2">
            {BUDGETS.map((b) => (
              <button key={b} type="button" aria-pressed={budget === b} onClick={() => setBudget(b)} className={chip(budget === b)} data-testid={`budget-${b}`}>
                {jt(`situation.budget.${b}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="font-semibold">{jt('situation.region.q')}</legend>
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((r) => (
              <button key={r} type="button" aria-pressed={region === r} onClick={() => setRegion(r)} className={chip(region === r)} data-testid={`region-${r}`}>
                {jt(`situation.region.${r}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="font-semibold">{jt('situation.work.q')}</legend>
          <div className="flex flex-wrap gap-2">
            {([true, false] as const).map((w) => (
              <button key={String(w)} type="button" aria-pressed={work === w} onClick={() => setWork(w)} className={chip(work === w)} data-testid={`work-${w}`}>
                {jt(w ? 'situation.work.yes' : 'situation.work.no')}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden />
          {jt('situation.private')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              await onSave({ budget, region, work });
              setEditing(false);
            }}
            disabled={budget === undefined && region === undefined && work === undefined}
            data-testid="situation-save"
          >
            {jt('situation.save')}
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            {jt('situation.later')}
          </Button>
        </div>
      </section>
    );

  if (!situation)
    return (
      <section className="flex flex-col gap-3 rounded-3xl border-2 border-dashed border-brand-lavender p-4" data-testid="situation-invite">
        <p className="flex items-center gap-2 font-bold">
          <HandHeart className="size-5 text-primary" aria-hidden />
          {jt('situation.title')}
        </p>
        <p className="text-sm text-muted-foreground">{jt('situation.intro')}</p>
        <Button variant="outline" className="self-start" onClick={() => setEditing(true)} data-testid="situation-open">
          {jt('situation.answer')}
        </Button>
      </section>
    );

  const marked = hurdles ? [...affecting(situation, hurdles)] : [];
  return (
    <section className="space-y-2 rounded-3xl bg-brand-lavender/60 p-4 text-brand-ink dark:bg-secondary dark:text-secondary-foreground" data-testid="situation-summary">
      <p className="flex items-center gap-2 font-bold">
        <HandHeart className="size-5 text-primary" aria-hidden />
        {jt('situation.title')}
      </p>
      {hurdles ? (
        marked.length ? (
          <p className="text-sm" data-testid="situation-affects">
            {jt('situation.affects')} <span className="font-semibold">{marked.map((k) => t(`kinds.${k}`)).join(sep)}</span>
          </p>
        ) : (
          <p className="text-sm">{jt('situation.none')}</p>
        )
      ) : (
        <p className="text-sm">{jt('situation.saved')}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-testid="situation-edit">
          {jt('situation.edit')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void onSave(null)} data-testid="situation-forget">
          {jt('situation.forget')}
        </Button>
      </div>
    </section>
  );
}
