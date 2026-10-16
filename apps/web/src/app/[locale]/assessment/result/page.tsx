import { instruments } from '@anabokra/content';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { AssessmentBlocked } from '@/features/assessment/blocked';
import { FinalizeRunner } from '@/features/assessment/finalize-runner';
import { AssessmentProvider } from '@/features/assessment/ui-context';
import { LocalResult } from '@/features/local/local-result';
import { loadResultView } from '@/features/results/load';
import { ResultsFlow } from '@/features/results/results-flow';
import { genderedT } from '@/features/results/gendered';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { DATA_MODE } from '@/lib/data-mode';
import { AssessmentError } from '@/server/assessment/errors';
import { loadAssessment, requireRuntime } from '@/server/assessment/page-data';
import { careerFacts } from '@/server/content/career-facts';

export const dynamic = 'force-dynamic';

/**
 * The end of the journey: finalize if needed, then reveal -> readiness -> profile + matches + share.
 * `?s=<sessionId>` (set right after finalizing) plays the reveal; opening the page later goes straight to the profile.
 */
export default async function ResultPage({ params, searchParams }: PageProps<'/[locale]/assessment/result'>) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const sid = typeof sp.s === 'string' ? sp.s : undefined;
  if (DATA_MODE === 'local') return <LocalResult sessionId={sid} facts={careerFacts()} />;
  const t = await getTranslations('Results');
  const lang = locale as Locale;

  const runtime = await requireRuntime(lang, '/assessment/result');
  const profile = await runtime.profile();
  const tr = (key: string) => genderedT(t as never, lang, profile.gender, key);

  const entry = sid ? null : await runtime.service.getEntryState(runtime.userId);
  const open = entry?.kind === 'open' ? await loadAssessment(lang, '/assessment/result') : null;
  if (open && !open.ok) return <AssessmentBlocked code={open.code} />;
  const finalizing = open?.ok === true && open.progress.canFinalize ? open : null;

  let result: Awaited<ReturnType<typeof runtime.service.getLatestResult>> = null;
  if (sid) {
    try {
      result = await runtime.service.getResult(runtime.userId, { sessionId: sid });
    } catch (e) {
      if (!(e instanceof AssessmentError)) throw e;
    }
  } else if (!finalizing) {
    result = await runtime.service.getLatestResult(runtime.userId);
  }

  const view = result ? await loadResultView(result, lang, profile.gender) : null;
  const readinessDone = result ? await runtime.service.hasPostReadiness(runtime.userId, result.sessionId) : true;
  const interests = (result?.scores.interests ?? {}) as Record<'R' | 'I' | 'A' | 'S' | 'E' | 'C', number>;
  const rd = instruments.readiness;
  const summary = (result?.summary ?? {}) as { partial?: boolean };

  return (
    <AssessmentProvider gender={profile.gender}>
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <Link href="/assessment" className="text-sm text-primary underline-offset-4 hover:underline">
            {tr('back')}
          </Link>
          <LocaleSwitcher />
        </header>

        {view && result ? (
          <div data-testid="result" className="flex flex-1 flex-col">
            <ResultsFlow
              view={view}
              worldProfile={{ interests }}
              fresh={Boolean(sid)}
              readinessDone={readinessDone}
              readiness={{ items: rd.items.map((i) => ({ id: i.id, text: i.text })), labels: rd.responseScale.labels, min: rd.responseScale.min }}
              partial={summary.partial === true}
            />
          </div>
        ) : finalizing ? (
          <FinalizeRunner sessionId={finalizing.sessionId} />
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p>{tr('notReady')}</p>
            <Button asChild>
              <Link href="/assessment">{tr('toHub')}</Link>
            </Button>
          </div>
        )}
      </main>
    </AssessmentProvider>
  );
}
