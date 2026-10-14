/**
 * Patience (a delay-of-reward game): each round a small fish bites now, or a big one comes if you
 * wait a few seconds. Waiting only costs time; there is no risk, so the choice reflects patience,
 * not gambling. You can stop waiting at any moment and take the small one. Prototype for the
 * psychologist (docs/product/games.md); not scored into results.
 */

/** Seconds to wait for the big fish in each round (varied, getting longer). */
export const PATIENCE_DELAYS = [4, 8, 6, 12, 10, 15] as const;
export const SMALL = 1;
export const BIG = 3;

export interface PatienceRound {
  delay: number;
  /** 'now': took the small fish at once; 'waited': got the big one; 'stopped': began waiting, then took the small one. */
  choice: 'now' | 'waited' | 'stopped';
  /** Seconds actually waited. */
  waited: number;
  /** Time to decide at the start of the round. */
  decideMs: number;
}

export function patienceSummary(rounds: PatienceRound[]) {
  const chose = rounds.filter((r) => r.choice !== 'now');
  const waited = rounds.filter((r) => r.choice === 'waited');
  const stopped = rounds.filter((r) => r.choice === 'stopped');
  return {
    rounds: rounds.length,
    choseToWait: chose.length,
    waitedToTheEnd: waited.length,
    stoppedEarly: stopped.length,
    /** Of the waits begun, how far through they got on average (0–1). */
    meanShareWaited: chose.length ? chose.reduce((s, r) => s + Math.min(1, r.waited / r.delay), 0) / chose.length : 0,
    /** Longest delay the player waited out in full. */
    longestWaited: waited.reduce((m, r) => Math.max(m, r.delay), 0),
    fish: rounds.reduce((s, r) => s + (r.choice === 'waited' ? BIG : SMALL), 0),
    secondsWaited: Math.round(rounds.reduce((s, r) => s + r.waited, 0)),
  };
}
