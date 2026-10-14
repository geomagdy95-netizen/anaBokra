'use client';

import { Brain, Calculator, Fish, Grid3x3, Shapes, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { AssessmentProvider } from '@/features/assessment/ui-context';

import { MemoryGame, NumbersGame, RotationGame } from './ability-games';
import { memorySummary, type MemoryTrial } from './memory';
import { patienceSummary, type PatienceRound } from './patience';
import { PatienceGame } from './patience-game';
import { choiceSummary, type ChoiceAnswer } from './pattern';
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

type ChoiceId = 'pattern' | 'numbers' | 'rotation';
type GameId = ChoiceId | 'memory' | 'patience';
type Result = { game: ChoiceId; answers: ChoiceAnswer[] } | { game: 'memory'; trials: MemoryTrial[] } | { game: 'patience'; rounds: PatienceRound[] };

const GAMES: [GameId, typeof Brain][] = [
  ['pattern', Brain],
  ['numbers', Calculator],
  ['rotation', Shapes],
  ['memory', Grid3x3],
  ['patience', Fish],
];

function Inner() {
  const t = useTranslations('DevGames');
  const gt = useGT();
  const [playing, setPlaying] = useState<GameId | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  // New items on each play, so the team can try many.
  const [seed, setSeed] = useState(1);
  const finish = (r: Result) => {
    setResult(r);
    setPlaying(null);
  };

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
        {playing === 'pattern' && <PatternGame seed={seed} onDone={(answers) => finish({ game: 'pattern', answers })} />}
        {playing === 'numbers' && <NumbersGame seed={seed} onDone={(answers) => finish({ game: 'numbers', answers })} />}
        {playing === 'rotation' && <RotationGame seed={seed} onDone={(answers) => finish({ game: 'rotation', answers })} />}
        {playing === 'memory' && <MemoryGame seed={seed} onDone={(trials) => finish({ game: 'memory', trials })} />}
        {playing === 'patience' && <PatienceGame onDone={(rounds) => finish({ game: 'patience', rounds })} />}
      </main>
    );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-6" data-testid="dev-games">
      <header className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <LocaleSwitcher />
      </header>
      <p className="text-sm text-muted-foreground">{t('intro')}</p>

      {result && <ResultCard result={result} />}

      <ul className="flex flex-col gap-3">
        {GAMES.map(([id, Icon]) => (
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
                setSeed((s) => s + 1);
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
  const { summary, message, raw } =
    result.game === 'memory'
      ? (() => {
          const s = memorySummary(result.trials);
          return { summary: s, message: gt('memory.done', { span: s.span }), raw: result.trials };
        })()
      : result.game === 'patience'
        ? (() => {
            const s = patienceSummary(result.rounds);
            return { summary: s, message: gt('patience.done', { fish: s.fish }), raw: result.rounds };
          })()
        : (() => {
            const s = choiceSummary(result.answers);
            return { summary: s, message: gt(`${result.game}.done`, { hardest: s.hardestSolved }), raw: result.answers };
          })();
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-brand-orange-soft/15 p-4" data-testid="game-result">
      <p className="font-semibold">{message}</p>
      <h2 className="text-xs font-semibold text-muted-foreground">{t('measured')}</h2>
      <pre className="overflow-x-auto rounded-xl bg-card p-3 text-xs" dir="ltr">
        {JSON.stringify({ summary, raw }, null, 1)}
      </pre>
    </section>
  );
}
