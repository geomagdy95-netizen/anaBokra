import { median, variance } from './stats';
import type { ItemResponse, LikertInstrument } from './types';

export type QualityFlag = 'straightLining' | 'tooFast' | 'attentionFailed' | 'lowVariance';

export interface QualityReport {
  flags: QualityFlag[];
  longestRun: number;
  medianMs?: number;
  attentionChecks: { total: number; passed: number };
}

export interface QualityOptions {
  /** Longest run of identical consecutive answers allowed before flagging (default 12). */
  maxRun?: number;
  /** Median response time below this (ms) is flagged as rushing (default 1200). */
  minMedianMs?: number;
}

/**
 * Data-quality checks run per session. Flags never block results; they mark a session
 * for a gentle "slow down" prompt and for exclusion from norm/reliability analyses.
 */
export function checkQuality(
  instrument: LikertInstrument,
  responses: ItemResponse[],
  { maxRun = 12, minMedianMs = 1200 }: QualityOptions = {},
): QualityReport {
  const flags: QualityFlag[] = [];
  const checks = instrument.items.filter((i) => i.attentionCheck);
  const checkIds = new Set(checks.map((c) => c.id));
  const scored = responses.filter((r) => !checkIds.has(r.itemId));

  let longestRun = 0;
  let run = 0;
  for (let i = 0; i < scored.length; i++) {
    run = i > 0 && scored[i]!.value === scored[i - 1]!.value ? run + 1 : 1;
    longestRun = Math.max(longestRun, run);
  }
  if (longestRun > maxRun) flags.push('straightLining');
  if (scored.length >= 10 && variance(scored.map((r) => r.value)) < 0.15) flags.push('lowVariance');

  const times = scored.map((r) => r.ms).filter((ms): ms is number => typeof ms === 'number');
  const medianMs = times.length ? median(times) : undefined;
  if (medianMs !== undefined && times.length >= 10 && medianMs < minMedianMs) flags.push('tooFast');

  const byId = new Map(responses.map((r) => [r.itemId, r.value]));
  const answeredChecks = checks.filter((c) => byId.has(c.id));
  const passed = answeredChecks.filter((c) => byId.get(c.id) === c.attentionCheck!.expected).length;
  if (passed < answeredChecks.length) flags.push('attentionFailed');

  return { flags, longestRun, medianMs, attentionChecks: { total: answeredChecks.length, passed } };
}
