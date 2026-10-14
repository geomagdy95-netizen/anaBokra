'use client';

import { Brain, Calculator, Fish, Grid3x3, Shapes, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { AssessmentProvider } from '@/features/assessment/ui-context';

import { MemoryGame, NumbersGame, RotationGame } from './ability-games';
import { GameResult, GamesSummary, type GameResultData } from './game-result';
import { PatienceGame } from './patience-game';
import { PatternGame } from './pattern-game';
import { sampleNorms, type GameNorms } from './score';
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

type GameId = 'pattern' | 'numbers' | 'rotation' | 'memory' | 'patience';

const GAMES: [GameId, typeof Brain][] = [
  ['pattern', Brain],
  ['numbers', Calculator],
  ['rotation', Shapes],
  ['memory', Grid3x3],
  ['patience', Fish],
];

/** The score spread from the server (anonymous opt-in scores), or null when it can't be fetched. */
function useServerNorms(): GameNorms | null {
  const [norms, setNorms] = useState<GameNorms | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/stats/norms')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { norms?: GameNorms } | null) => alive && setNorms(j?.norms ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return norms;
}

function Inner() {
  const t = useTranslations('DevGames');
  const gt = useGT();
  const [playing, setPlaying] = useState<GameId | null>(null);
  const [result, setResult] = useState<GameResultData | null>(null);
  // The latest result of each game, for the summary of all games.
  const [all, setAll] = useState<Partial<Record<GameId, GameResultData>>>({});
  const [preview, setPreview] = useState(true);
  const serverNorms = useServerNorms();
  const norms = preview ? sampleNorms() : serverNorms;
  // New items on each play, so the team can try many.
  const [seed, setSeed] = useState(1);
  const finish = (r: GameResultData) => {
    setResult(r);
    setAll((a) => ({ ...a, [r.game]: r }));
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
        {playing === 'pattern' && <PatternGame seed={seed} onDone={(answers, info) => finish({ game: 'pattern', answers, info })} />}
        {playing === 'numbers' && <NumbersGame seed={seed} onDone={(answers, info) => finish({ game: 'numbers', answers, info })} />}
        {playing === 'rotation' && <RotationGame seed={seed} onDone={(answers, info) => finish({ game: 'rotation', answers, info })} />}
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
      <label className="flex items-center gap-3 rounded-2xl bg-secondary p-3 text-sm">
        <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={preview} onChange={(e) => setPreview(e.target.checked)} data-testid="preview-norms" />
        {t('preview')}
      </label>

      {result && <GameResult result={result} norms={norms} ageBand={null} />}
      {Object.keys(all).length > 0 && <GamesSummary results={all} norms={norms} ageBand={null} />}

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
