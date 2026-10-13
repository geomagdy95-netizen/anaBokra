import type { Locale } from '@/i18n/routing';
import { loadLocalAssessment } from '@/features/local/load';
import type { LocalRuntime } from '@/lib/local/runtime';
import type { AssessmentErrorCode } from '@/server/assessment/errors';
import type { Preview } from '@/server/assessment/scoring';
import type { ReadinessRecord } from '@/server/assessment/types';

import { discoverStatus } from './discover-plan';
import { readJourney, type JourneyDoc } from './verify';

/** Days after the first path result before the follow-up readiness check is offered (pilot plan; to settle). */
export const FOLLOW_UP_DAYS = 7;

export interface JourneyData {
  rt: LocalRuntime;
  sessionId: string;
  /** The assessment session can still take answers (it closes when the first result is made). */
  open: boolean;
  answers: Record<string, number>;
  preview: Preview;
  journey: JourneyDoc;
  readiness: ReadinessRecord[];
  discover: ReturnType<typeof discoverStatus>;
  valuesDone: boolean;
  hasResult: boolean;
}

export type JourneyLoad =
  | { kind: 'first-start' }
  | { kind: 'locked'; nickname: string | null }
  | { kind: 'blocked'; code: AssessmentErrorCode } | ({ kind: 'ready' } & JourneyData);

/** Everything the journey screens need, read from the phone. */
export async function loadJourney(locale: Locale): Promise<JourneyLoad> {
  const data = await loadLocalAssessment(locale);
  if (data.ok === 'first-start') return { kind: 'first-start' };
  if (data.ok === 'locked') return { kind: 'locked', nickname: data.nickname };
  if (data.ok === false) return { kind: 'blocked', code: data.code };
  const { rt } = data;
  const sessionId = data.ok === 'results' ? data.entry.sessionId : data.sessionId;
  const [resume, preview, progress, journey, readiness] = await Promise.all([
    rt.service.getResume(rt.userId, { sessionId }),
    rt.service.preview(rt.userId, { sessionId }),
    rt.service.getProgress(rt.userId, { sessionId }),
    readJourney(rt.device.kv, rt.userId),
    rt.repo.listReadiness(),
  ]);
  const answers = Object.fromEntries(resume.responses.map((r) => [r.itemId, r.value]));
  return {
    kind: 'ready',
    rt,
    sessionId,
    open: data.ok === true,
    answers,
    preview,
    journey,
    readiness,
    discover: discoverStatus(new Set(Object.keys(answers))),
    valuesDone: progress.stations.find((s) => s.id === 'values')?.done ?? false,
    hasResult: data.ok === 'results' || progress.hasResult,
  };
}

/**
 * Makes the stored result once Discover is finished, values are sorted and a first path is checked
 * (so a result has every part). The session then closes; statistics and research (if opted in) are
 * sent from that result. Safe to call any time: it does nothing until all three are true.
 */
export async function maybeFinalize(
  d: Pick<JourneyData, 'rt' | 'sessionId'>,
  { send = sendOptIns }: { send?: (rt: LocalRuntime) => Promise<void> } = {},
): Promise<boolean> {
  const { rt, sessionId } = d;
  const progress = await rt.service.getProgress(rt.userId, { sessionId });
  if (progress.hasResult || !progress.canFinalize) return false;
  const resume = await rt.service.getResume(rt.userId, { sessionId });
  const discover = discoverStatus(new Set(resume.responses.map((r) => r.itemId)));
  const values = progress.stations.find((s) => s.id === 'values')?.done ?? false;
  const journey = await readJourney(rt.device.kv, rt.userId);
  const checked = Object.values(journey.paths).some((p) => p.result);
  if (discover.next !== null || !values || !checked) return false;
  await rt.service.finalize(rt.userId, { sessionId });
  await send(rt);
  return true;
}

/** Opt-in statistics and research for the new result; both never throw. */
async function sendOptIns(rt: LocalRuntime) {
  const [{ syncStats }, { syncResearch }] = await Promise.all([import('@/lib/local/stats'), import('@/lib/local/research')]);
  await Promise.all([syncStats(rt), syncResearch(rt)]);
}
