import type { Locale } from '@/i18n/routing';
import { loadLocalAssessment } from '@/features/local/load';
import type { LocalRuntime } from '@/lib/local/runtime';
import type { AssessmentErrorCode } from '@/server/assessment/errors';
import type { Preview } from '@/server/assessment/scoring';
import type { AnswerFormats } from '@/server/assessment/config';
import type { ReadinessRecord } from '@/server/assessment/types';

import { discoverStatus, interestsSettled } from './discover-plan';
import { abilityStandings, cachedNorms, comparisonBand, playedGameSteps } from './games';
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
  /** How this session asks interests and values (checklist or 1–5 scale; budget or card sort). */
  formats: AnswerFormats;
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
  const journey = await readJourney(rt.device.kv, rt.userId);
  const games = await gameStandingsFor(rt, journey);
  const [resume, preview, progress, readiness] = await Promise.all([
    rt.service.getResume(rt.userId, { sessionId }),
    rt.service.preview(rt.userId, { sessionId, ...(games ? { games } : {}) }),
    rt.service.getProgress(rt.userId, { sessionId }),
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
    discover: discoverStatus(new Set([...Object.keys(answers), ...playedGameSteps(journey)]), { gamesRequired: data.ok === true, settled: interestsSettled(answers) }),
    valuesDone: progress.stations.find((s) => s.id === 'values')?.done ?? false,
    hasResult: data.ok === 'results' || progress.hasResult,
    formats: resume.formats,
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
  const journey = await readJourney(rt.device.kv, rt.userId);
  const answered = Object.fromEntries(resume.responses.map((r) => [r.itemId, r.value]));
  const discover = discoverStatus(new Set([...Object.keys(answered), ...playedGameSteps(journey)]), { settled: interestsSettled(answered) });
  const values = progress.stations.find((s) => s.id === 'values')?.done ?? false;
  const checked = Object.values(journey.paths).some((p) => p.result);
  if (discover.next !== null || !values || !checked) return false;
  const games = await gameStandingsFor(rt, journey);
  await rt.service.finalize(rt.userId, { sessionId, ...(games ? { games } : {}) });
  await send(rt);
  return true;
}

/**
 * Where the user's games stand among other players, per ability, from the comparison table cached on
 * the phone. Undefined when no game has enough players yet (then abilities use the self-ratings alone).
 */
export async function gameStandingsFor(rt: LocalRuntime, journey: JourneyDoc) {
  if (!journey.games) return undefined;
  const standings = abilityStandings(journey, await cachedNorms(rt.device.kv), comparisonBand(rt.profile.ageBand));
  return Object.keys(standings).length ? standings : undefined;
}

/** Opt-in statistics and research for the new result; both never throw. */
async function sendOptIns(rt: LocalRuntime) {
  const [{ syncStats }, { syncResearch }] = await Promise.all([import('@/lib/local/stats'), import('@/lib/local/research')]);
  await Promise.all([syncStats(rt), syncResearch(rt)]);
}
