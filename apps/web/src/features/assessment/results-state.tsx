'use client';

import { useLocale } from 'next-intl';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { RETAKE_AFTER_DAYS, type RetakeStatus } from '@/server/assessment/retake';

import { useAT } from './ui-context';

/** Hub state for a student who finished the assessment and has no session in progress. */
export function ResultsState({ completedAt, retake }: { completedAt: string; retake: RetakeStatus }) {
  const t = useAT();
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' });
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-10" data-testid="results-state">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
          {t('hub.home')}
        </Link>
        <LocaleSwitcher />
      </header>
      <h1 className="text-3xl font-semibold">{t('resultsState.title')}</h1>
      <p>{t('resultsState.body', { date: fmt.format(new Date(completedAt)) })}</p>
      <div>
        <Button asChild size="lg" data-testid="see-latest-results">
          <Link href="/assessment/result">{t('hub.seeResults')}</Link>
        </Button>
      </div>
      <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
        <h2 className="text-lg font-semibold">{t('resultsState.retakeTitle')}</h2>
        {retake.allowed ? (
          <>
            <p className="text-sm text-muted-foreground">{t('resultsState.retakeReady')}</p>
            <div>
              <Button asChild variant="outline" data-testid="retake">
                <Link href="/assessment?retake=1">{t('resultsState.retake')}</Link>
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="retake-locked">
            {t('resultsState.retakeLocked', { date: fmt.format(new Date(retake.unlocksAt)), days: RETAKE_AFTER_DAYS })}
          </p>
        )}
      </section>
    </main>
  );
}
