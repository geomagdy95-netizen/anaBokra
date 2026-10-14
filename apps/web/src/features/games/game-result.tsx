'use client';

import { Clock, Trophy, Users } from 'lucide-react';
import { useLocale } from 'next-intl';

import { cn } from '@/lib/utils';

import type { RunInfo } from './choice-game';
import type { MemoryTrial } from './memory';
import type { PatienceRound } from './patience';
import { patienceSummary } from './patience';
import { choiceSummary, type ChoiceAnswer } from './pattern';
import { choicePoints, MAX_POINTS, memoryPoints, normGroup, standing, standingBand, TIME_LIMIT, type AgeBand, type GameNorms, type RankedGame } from './score';
import { useGT } from './use-gt';

export type GameResultData =
  | { game: 'pattern' | 'numbers' | 'rotation'; answers: ChoiceAnswer[]; info: RunInfo }
  | { game: 'memory'; trials: MemoryTrial[] }
  | { game: 'patience'; rounds: PatienceRound[] };

const mmss = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** A ring that fills with the share of points earned. */
function Ring({ value, max }: { value: number; max: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-24 shrink-0">
      <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--secondary)" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / max)} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground tabular-nums">/ {max}</span>
      </div>
    </div>
  );
}

/** How everyone scored, with the player's own score picked out. */
function Spread({ counts, score }: { counts: number[]; score: number }) {
  const top = Math.max(1, ...counts);
  return (
    <div className="flex h-16 items-end gap-0.5" dir="ltr" aria-hidden>
      {counts.map((n, s) => (
        <div key={s} className={cn('flex-1 rounded-t', s === score ? 'bg-primary' : 'bg-primary/20')} style={{ height: `${Math.max(4, (n / top) * 100)}%` }} />
      ))}
    </div>
  );
}

/**
 * What a player sees after a game: points and time, how they did by level, and how that compares
 * with other players (once enough have played). Patience has no points or rank: it shows how they
 * played. The raw measures stay folded away, for the psychologist.
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
        <p className="text-lg font-bold">{gt('patience.done', { fish: s.fish })}</p>
        <p className="text-sm">{gt('result.patienceWaited', { waited: s.waitedToTheEnd, rounds: s.rounds })}</p>
        <p className="rounded-2xl bg-secondary p-3 text-sm text-muted-foreground">{gt('result.patienceNoRank')}</p>
        <Raw data={{ summary: s, raw: result.rounds }} />
      </section>
    );
  }

  const game: RankedGame = result.game;
  const points = result.game === 'memory' ? memoryPoints(result.trials) : choicePoints(result.answers);
  const max = MAX_POINTS[game];
  const group = normGroup(norms, game, ageBand);
  const p = group ? standing(points, group.hist) : null;
  const choice = result.game === 'memory' ? null : choiceSummary(result.answers, 8);
  const limit = TIME_LIMIT[game];

  return (
    <section className="flex flex-col gap-5 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-border/70" data-testid="game-result">
      <div className="flex items-center gap-4">
        <Ring value={points} max={max} />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">{gt(`${game}.title`)}</p>
          <p className="text-lg font-bold leading-snug">{gt('result.points', { points, max })}</p>
          {result.game !== 'memory' && limit ? (
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
              <Clock className="size-4" aria-hidden />
              {result.info.timedOut ? gt('result.timeUp') : gt('result.time', { used: mmss(result.info.timeMs), limit: mmss(limit * 1000) })}
            </p>
          ) : null}
        </div>
      </div>

      {choice ? (
        <ul className="grid grid-cols-4 gap-2" aria-label={gt('result.byLevel')}>
          {[1, 2, 3, 4].map((l) => (
            <li key={l} className="rounded-2xl bg-secondary p-2 text-center">
              <span className="block text-[11px] text-muted-foreground">{gt('result.level', { n: l })}</span>
              <span className="text-base font-bold tabular-nums">{choice.byLevel[l] ?? 0}/2</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-secondary p-3 text-sm">{gt('memory.done', { span: points })}</p>
      )}

      <div className="flex flex-col gap-3 rounded-2xl bg-brand-orange-soft/15 p-4" data-testid="game-standing">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4 text-primary" aria-hidden />
          {gt('result.othersTitle')}
        </p>
        {group && p !== null ? (
          <>
            <div className="flex items-center gap-3">
              {standingBand(p) !== 'onTheWay' && (
                <span className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">
                  <Trophy className="size-4" aria-hidden />
                  {gt(`result.band.${standingBand(p)}`)}
                </span>
              )}
              {/* Below a quarter, no bare number: an encouraging line instead (the chart still shows where they are). */}
              <p className="text-sm font-medium">{p < 0.25 ? gt('result.startingOut') : gt(group.scope === 'age' ? 'result.betterThanAge' : 'result.betterThan', { pct: pct.format(p) })}</p>
            </div>
            <Spread counts={group.hist.counts} score={points} />
            <p className="text-xs text-muted-foreground">
              {gt('result.basedOn', { n: num.format(group.hist.n) })}
              {standingBand(p) === 'onTheWay' ? ` ${gt('result.onTheWay')}` : ''}
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
