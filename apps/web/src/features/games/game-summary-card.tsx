'use client';

import type { GameId, GameRecord } from '@/lib/journey/games';

import { GAME_ICON, PlaceScale } from './game-result';
import { GAME_ABILITY, normGroup, standing, standingBand, type AgeBand, type GameNorms } from './score';
import { useGT } from './use-gt';

const ORDER: GameId[] = ['pattern', 'numbers', 'rotation', 'memory', 'patience'];

/**
 * "Your strengths from the games" on my island, from the first plays kept on the phone: one row per
 * strength with its place among other players (once enough have played), and how they count.
 */
export function GamesSummary({ records, norms, ageBand }: { records: Partial<Record<GameId, GameRecord>>; norms: GameNorms | null; ageBand: AgeBand | null }) {
  const gt = useGT();
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-border/70" data-testid="games-summary">
      <h2 className="text-lg font-bold">{gt('summary.title')}</h2>
      <ul className="flex flex-col gap-3">
        {ORDER.map((game) => {
          const rec = records[game];
          const Icon = GAME_ICON[game];
          const group = rec && game !== 'patience' ? normGroup(norms, game, ageBand) : null;
          const p = rec && group ? standing(rec.points, group.hist) : null;
          const counts = game !== 'patience' && Boolean(GAME_ABILITY[game]);
          return (
            <li key={game} className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {gt(`summary.strength.${game}`)}
                  <span className="font-normal text-muted-foreground"> · {gt(`${game}.title`)}</span>
                </p>
                {!rec ? (
                  <p className="text-xs text-muted-foreground">{gt('summary.notPlayed')}</p>
                ) : game === 'patience' ? (
                  <p className="text-xs">{gt('summary.patience', { waited: rec.shown, rounds: rec.of })}</p>
                ) : p !== null ? (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1">
                      <PlaceScale p={p} compact />
                    </div>
                    <span className="shrink-0 text-xs font-medium">{gt(`summary.band.${standingBand(p)}`)}</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {game === 'memory' ? gt('result.longestPath', { n: rec.shown }) : gt('result.right', { n: rec.shown, of: rec.of })} · {gt('summary.noPlace')}
                  </p>
                )}
                {rec && !counts && game !== 'patience' && <p className="text-[11px] text-muted-foreground">{gt('summary.extra')}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="rounded-2xl bg-secondary p-3 text-xs text-muted-foreground">{gt('summary.howItCounts')}</p>
    </section>
  );
}
