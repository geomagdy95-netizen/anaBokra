'use client';

import { Brain, Calculator, Clock, Fish, Grid3x3, Shapes, Users, type LucideIcon } from 'lucide-react';
import { useLocale } from 'next-intl';

import type { GameRecord } from '@/lib/journey/games';
import { cn } from '@/lib/utils';

import type { RunInfo } from './choice-game';
import type { MemoryTrial } from './memory';
import { MAX as MEMORY_MAX } from './memory';
import { patienceSummary, type PatienceRound } from './patience';
import { choiceSummary, type ChoiceAnswer } from './pattern';
import { choicePoints, GAME_ABILITY, memoryPoints, normGroup, standing, standingBand, TIME_LIMIT, type AgeBand, type GameNorms, type RankedGame } from './score';
import { useGT } from './use-gt';

export type GameResultData =
  | { game: 'pattern' | 'numbers' | 'rotation'; answers: ChoiceAnswer[]; info: RunInfo }
  | { game: 'memory'; trials: MemoryTrial[] }
  | { game: 'patience'; rounds: PatienceRound[] };

export const GAME_ICON: Record<GameResultData['game'], LucideIcon> = { pattern: Brain, numbers: Calculator, rotation: Shapes, memory: Grid3x3, patience: Fish };

const mmss = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Points used for the comparison (harder puzzles count more), and the plain count shown to the player. */
function scoreOf(result: Exclude<GameResultData, { game: 'patience' }>) {
  if (result.game === 'memory') {
    const span = memoryPoints(result.trials);
    return { points: span, shown: span, of: MEMORY_MAX };
  }
  return { points: choicePoints(result.answers), shown: result.answers.filter((a) => a.correct).length, of: 8 };
}

/** What is kept on the phone from a first full play (lib/journey/games.ts). */
export function recordOf(result: GameResultData, at: string): GameRecord {
  if (result.game === 'patience') {
    const s = patienceSummary(result.rounds);
    return { at, points: 0, shown: s.waitedToTheEnd, of: s.rounds };
  }
  const { points, shown, of } = scoreOf(result);
  return { at, points, shown, of, ...(result.game === 'memory' ? {} : { timeMs: result.info.timeMs, timedOut: result.info.timedOut }) };
}

/** Where the player stands among others, or null until enough have played. */
export function placeOf(result: GameResultData, norms: GameNorms | null, ageBand: AgeBand | null) {
  if (result.game === 'patience') return null;
  const group = normGroup(norms, result.game, ageBand);
  return group ? { p: standing(scoreOf(result).points, group.hist), n: group.hist.n, scope: group.scope } : null;
}

/** A ring filled with the share right. */
function Ring({ value, max }: { value: number; max: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-24 shrink-0">
      <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--secondary)" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / max)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center leading-none">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">/ {max}</span>
      </div>
    </div>
  );
}

/** A scale from lower to higher scores among other players, with the player's marker. */
export function PlaceScale({ p, compact = false }: { p: number; compact?: boolean }) {
  const gt = useGT();
  return (
    <div className={cn('flex flex-col', compact ? 'gap-0.5' : 'gap-1')}>
      <div className={cn('relative rounded-full bg-gradient-to-r from-primary/10 via-primary/25 to-primary/60 rtl:bg-gradient-to-l', compact ? 'h-2' : 'h-3')}>
        <span className="absolute top-1/2 -translate-y-1/2" style={{ insetInlineStart: `calc(${p * 100}% - ${compact ? 7 : 10}px)` }}>
          <span className={cn('block rounded-full border-2 border-white bg-primary shadow', compact ? 'size-3.5' : 'size-5')} />
        </span>
      </div>
      {!compact && (
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{gt('result.lower')}</span>
          <span>{gt('result.higher')}</span>
        </div>
      )}
    </div>
  );
}

const LEVEL_KEYS = ['easy', 'medium', 'hard', 'hardest'] as const;

/**
 * What a player sees after a game, in plain words: how many right (and time), how they did on easy
 * to hardest puzzles, and where that puts them among other players (once enough have played).
 * Patience has no score or place: it shows how they chose to play. Raw measures fold away.
 */
export function GameResult({ result, norms, ageBand }: { result: GameResultData; norms: GameNorms | null; ageBand: AgeBand | null }) {
  const gt = useGT();
  const locale = useLocale();
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const num = new Intl.NumberFormat(locale);

  if (result.game === 'patience') {
    const s = patienceSummary(result.rounds);
    return (
      <section className="flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-border/70" data-testid="game-result">
        <p className="text-xs font-semibold text-muted-foreground">{gt('patience.title')}</p>
        <p className="text-lg font-bold">{gt('result.patienceWaited', { waited: s.waitedToTheEnd, rounds: s.rounds })}</p>
        <p className="text-sm">{gt('patience.done', { fish: s.fish })}</p>
        <p className="rounded-2xl bg-secondary p-3 text-sm text-muted-foreground">{gt('result.patienceNoRank')}</p>
        <Raw data={{ summary: s, raw: result.rounds }} />
      </section>
    );
  }

  const game: RankedGame = result.game;
  const { points, shown, of } = scoreOf(result);
  const place = placeOf(result, norms, ageBand);
  const choice = result.game === 'memory' ? null : choiceSummary(result.answers, 8);
  const limit = TIME_LIMIT[game];
  const band = place ? standingBand(place.p) : null;

  return (
    <section className="flex flex-col gap-5 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-border/70" data-testid="game-result">
      <div className="flex items-center gap-4">
        <Ring value={shown} max={of} />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">{gt(`${game}.title`)}</p>
          <p className="text-lg font-bold leading-snug">{result.game === 'memory' ? gt('result.longestPath', { n: shown }) : gt('result.right', { n: shown, of })}</p>
          {result.game !== 'memory' && limit ? (
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
              <Clock className="size-4" aria-hidden />
              {result.info.timedOut ? gt('result.timeUp') : gt('result.time', { used: mmss(result.info.timeMs), limit: mmss(limit * 1000) })}
            </p>
          ) : null}
        </div>
      </div>

      {choice && (
        <ul className="grid grid-cols-4 gap-2" aria-label={gt('result.byLevel')}>
          {LEVEL_KEYS.map((k, i) => {
            const right = choice.byLevel[i + 1] ?? 0;
            return (
              <li key={k} className="flex flex-col items-center gap-1.5 rounded-2xl bg-secondary px-1 py-2" aria-label={gt('result.levelRight', { level: gt(`result.levels.${k}`), n: right })}>
                <span className="text-[11px] text-muted-foreground">{gt(`result.levels.${k}`)}</span>
                <span className="flex gap-1" aria-hidden>
                  {[0, 1].map((d) => (
                    <span key={d} className={cn('size-3 rounded-full', d < right ? 'bg-primary' : 'border-2 border-primary/30')} />
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-3 rounded-2xl bg-brand-orange-soft/15 p-4" data-testid="game-standing">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4 text-primary" aria-hidden />
          {gt('result.othersTitle')}
        </p>
        {place && band ? (
          <>
            <p className="text-base font-bold">{gt(`result.band.${band}`, { pct: pct.format(place.p) })}</p>
            <PlaceScale p={place.p} />
            <p className="text-xs text-muted-foreground">
              {gt(place.scope === 'age' ? 'result.basedOnAge' : 'result.basedOn', { n: num.format(place.n) })}
              {band === 'below' || band === 'middle' ? ` ${gt('result.oneView')}` : ''}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{gt('result.notYet', { min: 100 })}</p>
        )}
      </div>

      <Raw data={{ points, summary: choice ?? { span: points }, info: result.game === 'memory' ? null : result.info, raw: result.game === 'memory' ? result.trials : result.answers }} />
    </section>
  );
}

/**
 * All the games together, as a player would see them on their island: one row per strength with
 * its place among other players, and how the games count in the results.
 */
export function GamesSummary({ results, norms, ageBand }: { results: Partial<Record<GameResultData['game'], GameResultData>>; norms: GameNorms | null; ageBand: AgeBand | null }) {
  const gt = useGT();
  const order: GameResultData['game'][] = ['pattern', 'numbers', 'rotation', 'memory', 'patience'];
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-border/70" data-testid="games-summary">
      <h2 className="text-lg font-bold">{gt('summary.title')}</h2>
      <ul className="flex flex-col gap-3">
        {order.map((game) => {
          const r = results[game];
          const Icon = GAME_ICON[game];
          const place = r ? placeOf(r, norms, ageBand) : null;
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
                {!r ? (
                  <p className="text-xs text-muted-foreground">{gt('summary.notPlayed')}</p>
                ) : r.game === 'patience' ? (
                  <p className="text-xs">{gt('summary.patience', { waited: patienceSummary(r.rounds).waitedToTheEnd, rounds: r.rounds.length })}</p>
                ) : place ? (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1">
                      <PlaceScale p={place.p} compact />
                    </div>
                    <span className="shrink-0 text-xs font-medium">{gt(`summary.band.${standingBand(place.p)}`)}</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{gt('summary.noPlace')}</p>
                )}
                {r && !counts && game !== 'patience' && <p className="text-[11px] text-muted-foreground">{gt('summary.extra')}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="rounded-2xl bg-secondary p-3 text-xs text-muted-foreground">{gt('summary.howItCounts')}</p>
    </section>
  );
}

function Raw({ data }: { data: unknown }) {
  const gt = useGT();
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="min-h-10 cursor-pointer py-2">{gt('result.details')}</summary>
      <pre className="overflow-x-auto rounded-xl bg-muted p-3" dir="ltr">
        {JSON.stringify(data, null, 1)}
      </pre>
    </details>
  );
}
