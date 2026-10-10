'use client';

import { instruments } from '@anabokra/content';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { SwipeCard } from '@/features/assessment/swipe-card';
import { DEFAULT_PALETTE } from '@/features/path/palette';
import { generateWorld } from '@/features/path/generate-world';
import { PathSvg } from '@/features/path/path-svg';
import { Link } from '@/i18n/navigation';

import { scoreTeaser, TEASER_ITEMS, TEASER_STORAGE_KEY, type TeaserAnswers } from './teaser';

type Phase = 'intro' | 'cards' | 'result';
const SCALE = [1, 2, 3, 4, 5] as const;

/** A2–A4: intro, 12 swipe cards, then a RIASEC preview and the "save my result" call to action. */
export function TeaserClient() {
  const t = useTranslations('Public.teaser');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const [phase, setPhase] = useState<Phase>('intro');
  const [answers, setAnswers] = useState<TeaserAnswers>({});
  const index = Object.keys(answers).length;
  const item = TEASER_ITEMS[index];
  const labels = instruments.interests.responseScale.labels;

  useEffect(() => {
    if (phase !== 'result') return;
    try {
      localStorage.setItem(TEASER_STORAGE_KEY, JSON.stringify(answers));
    } catch {
      // private mode: the result still shows, it just won't carry over to signup
    }
  }, [phase, answers]);

  const answer = (value: number) => {
    if (!item) return;
    const next = { ...answers, [item.id]: value };
    setAnswers(next);
    if (Object.keys(next).length === TEASER_ITEMS.length) setPhase('result');
  };

  if (phase === 'intro')
    return (
      <section className="mx-auto max-w-md space-y-5 text-center">
        <h1 className="text-3xl font-bold">{t('introTitle')}</h1>
        <p className="text-muted-foreground">{t('introBody', { n: TEASER_ITEMS.length })}</p>
        <p className="text-sm text-muted-foreground">{t('privacy')}</p>
        <Button size="lg" onClick={() => setPhase('cards')}>
          {t('start')}
        </Button>
      </section>
    );

  if (phase === 'cards' && item)
    return (
      <section className="mx-auto max-w-md space-y-5" aria-live="polite">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t('progress', { n: index + 1, total: TEASER_ITEMS.length })}</span>
          {index > 0 ? (
            <button
              type="button"
              className="underline"
              onClick={() => setAnswers((a) => Object.fromEntries(Object.entries(a).slice(0, -1)))}
            >
              {t('undo')}
            </button>
          ) : null}
        </div>
        <div className="h-1.5 overflow-hidden rounded bg-muted">
          <div className="h-full bg-primary transition-all" style={{ inlineSize: `${(index / TEASER_ITEMS.length) * 100}%` }} />
        </div>
        <SwipeCard key={item.id} ariaLabel={item.text[locale]} hintFor={(v) => labels[v - 1]?.[locale] ?? ''} onSwipe={(v) => answer(v)}>
          <p className="p-8 text-center text-xl font-medium">{item.text[locale]}</p>
        </SwipeCard>
        <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={t('scaleLabel')}>
          {SCALE.map((v) => (
            <Button key={v} variant="outline" className="h-auto whitespace-normal px-1 py-2 text-xs" onClick={() => answer(v)}>
              {labels[v - 1]?.[locale]}
            </Button>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">{t('swipeHint')}</p>
      </section>
    );

  return <TeaserResultView answers={answers} />;
}

function TeaserResultView({ answers }: { answers: TeaserAnswers }) {
  const t = useTranslations('Public.teaser');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const result = useMemo(() => scoreTeaser(answers), [answers]);
  const world = useMemo(() => generateWorld({ interests: result.scores }), [result]);
  const typeName = (k: string) => instruments.interests.scales.find((s) => s.id === k)?.name[locale] ?? k;

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">{t('resultTitle')}</h1>
        <p className="text-muted-foreground">{t('resultIntro')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {result.top.map((k) => (
          <div key={k} className="rounded-lg border bg-card p-4">
            <div className="text-lg font-semibold">{typeName(k)}</div>
            <p className="mt-1 text-sm text-muted-foreground">{t(`types.${k}` as 'types.R')}</p>
          </div>
        ))}
      </div>
      <div className="relative overflow-hidden rounded-lg border">
        <div className="aspect-[4/3] blur-[2px] saturate-75">
          <PathSvg world={world} progress={0} focus={null} onFocus={() => {}} palette={DEFAULT_PALETTE} label={t('worldLabel')} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 p-6 text-center">
          <p className="max-w-sm font-medium">{t('lockedWorld')}</p>
        </div>
      </div>
      <ul className="grid gap-2 text-sm sm:grid-cols-3">
        {(['tourCareers', 'tourOpportunities', 'tourRoadmap'] as const).map((k) => (
          <li key={k} className="rounded-md bg-muted p-3">
            {t(k)}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/login?next=/assessment">{t('save')}</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/careers">{t('browse')}</Link>
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">{t('disclaimer')}</p>
    </section>
  );
}
