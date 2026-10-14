'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { GameId, GameRecord } from '@/lib/journey/games';

import { MemoryGame, NumbersGame, RotationGame } from './ability-games';
import { GameResult, recordOf, type GameResultData } from './game-result';
import { PatienceGame } from './patience-game';
import { PatternGame } from './pattern-game';
import type { AgeBand, GameNorms } from './score';
import { useGT } from './use-gt';

export interface GameHost {
  norms: GameNorms | null;
  ageBand: AgeBand | null;
  /** Keeps the first full play; resolves false if it couldn't be saved. */
  save: (game: GameId, record: GameRecord) => Promise<boolean>;
}

/**
 * A game as a step of a Discover task: play it, keep the first full play, show the result, then go
 * on. Played before (coming back to the step): no replay, just carry on.
 */
export function DiscoverGame({ game, played, host, onContinue }: { game: GameId; played: boolean; host: GameHost; onContinue: () => void }) {
  const gt = useGT();
  const [result, setResult] = useState<GameResultData | null>(null);
  const [failed, setFailed] = useState(false);
  // Each player gets their own items, but the same ones if they come back mid-game.
  const [seed] = useState(() => Math.floor(Math.random() * 1_000_000));

  const finish = async (r: GameResultData) => {
    setResult(r);
    setFailed(!(await host.save(game, recordOf(r, new Date().toISOString()))));
  };

  if (played && !result)
    return (
      <div className="flex flex-col gap-4" data-testid="game-played">
        <p className="rounded-2xl bg-secondary p-4 text-sm">{gt('discover.played')}</p>
        <Button size="lg" className="h-14 rounded-2xl text-base" onClick={onContinue} data-testid="game-continue">
          {gt('discover.continue')}
        </Button>
      </div>
    );

  if (result)
    return (
      <div className="flex flex-col gap-4">
        <GameResult result={result} norms={host.norms} ageBand={host.ageBand} />
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {gt('discover.saveFailed')}
          </p>
        )}
        <Button size="lg" className="h-14 rounded-2xl text-base" onClick={onContinue} disabled={failed} data-testid="game-continue">
          {gt('discover.continue')}
        </Button>
      </div>
    );

  return (
    <div className="flex flex-col gap-4" data-testid={`discover-game-${game}`}>
      <p className="text-base font-bold">{gt(`${game}.title`)}</p>
      {game === 'pattern' && <PatternGame seed={seed} onDone={(answers, info) => void finish({ game, answers, info })} />}
      {game === 'numbers' && <NumbersGame seed={seed} onDone={(answers, info) => void finish({ game, answers, info })} />}
      {game === 'rotation' && <RotationGame seed={seed} onDone={(answers, info) => void finish({ game, answers, info })} />}
      {game === 'memory' && <MemoryGame seed={seed} onDone={(trials) => void finish({ game, trials })} />}
      {game === 'patience' && <PatienceGame onDone={(rounds) => void finish({ game, rounds })} />}
    </div>
  );
}
