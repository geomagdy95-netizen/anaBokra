'use client';

import { Brain, Fish, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { AssessmentProvider } from '@/features/assessment/ui-context';

import { patienceSummary, type PatienceRound } from './patience';
import { PatienceGame } from './patience-game';
import { patternSummary, type PatternAnswer } from './pattern';
import { PatternGame } from './pattern-game';
import { useGT } from './use-gt';

/**
 * Dev preview of the game prototypes (docs/product/games.md): play them on a phone and see what each
 * measures. Nothing is saved or scored into results.
 */
export function DevGamesClient() {
  return (
    <AssessmentProvider gender={null}>
      <Inner />
    </AssessmentProvider>
  );
}

type GameId = 'pattern' | 'patience';
type Result = { game: 'pattern'; answers: PatternAnswer[] } | { game: 'patience'; rounds: PatienceRound[] };

function Inner() {
  const t = useTranslations('DevGames');
  const gt = useGT();
  const [playing, setPlaying] = useState<GameId | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  // A new pattern set on each play, so the team can try many.
  const [seed, setSeed] = useState(1);

  if (playing)
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-6" data-testid={`game-${playing}`}>
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{gt(`${playing}.title`)}</h1>
          <Button variant="ghost" size="icon" onClick={() => setPlaying(null)} aria-label={t('close')}>
            <X className="size-5" />
          </Button>
        </header>
        <span aria-hidden="true" className="-mt-3 block h-1 w-10 rounded-full bg-brand-orange" />
        {playing === 'pattern' ? (
          <PatternGame
            seed={seed}
            onDone={(answers) => {
              setResult({ game: 'pattern', answers });
              setPlaying(null);
            }}
          />
        ) : (
          <PatienceGame
            onDone={(rounds) => {
              setResult({ game: 'patience', rounds });
              setPlaying(null);
            }}
          />
        )}
      </main>
    );

  const games: [GameId, typeof Brain][] = [
    ['pattern', Brain],
    ['patience', Fish],
  ];
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-6" data-testid="dev-games">
      <header className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <LocaleSwitcher />
      </header>
      <p className="text-sm text-muted-foreground">{t('intro')}</p>

      {result && <ResultCard result={result} />}

      <ul className="flex flex-col gap-3">
        {games.map(([id, Icon]) => (
          <li key={id} className="flex items-center gap-4 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-border/70">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
              <Icon className="size-7" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{gt(`${id}.title`)}</p>
              <p className="text-xs text-muted-foreground">{t(`measures.${id}`)}</p>
            </div>
            <Button
              onClick={() => {
                if (id === 'pattern') setSeed((s) => s + 1);
                setResult(null);
                setPlaying(id);
              }}
              data-testid={`play-${id}`}
            >
              {t('play')}
            </Button>
          </li>
        ))}
      </ul>
    </main>
  );
}

/** What the player sees at the end (kind words, no score), and below it what the game measured. */
function ResultCard({ result }: { result: Result }) {
  const t = useTranslations('DevGames');
  const gt = useGT();
  const summary = result.game === 'pattern' ? patternSummary(result.answers) : patienceSummary(result.rounds);
  const message =
    result.game === 'pattern'
      ? gt('pattern.done', { hardest: (summary as ReturnType<typeof patternSummary>).hardestSolved })
      : gt('patience.done', { fish: (summary as ReturnType<typeof patienceSummary>).fish });
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-brand-orange-soft/15 p-4" data-testid="game-result">
      <p className="font-semibold">{message}</p>
      <h2 className="text-xs font-semibold text-muted-foreground">{t('measured')}</h2>
      <pre className="overflow-x-auto rounded-xl bg-card p-3 text-xs" dir="ltr">
        {JSON.stringify({ summary, raw: result.game === 'pattern' ? result.answers : result.rounds }, null, 1)}
      </pre>
    </section>
  );
}
