import { STAGES } from '@anabokra/engine';

import { readJourney } from '@/lib/journey/verify';
import type { JourneyDoc } from '@/lib/journey/verify';
import {
  buildStatsSummary,
  statsGameSchema,
  statsPathSchema,
  statsRatingSchema,
  statsStepSchema,
  statsUsageSchema,
  statsViewSchema,
  type STEPS,
  type StatsSender,
  type StatsSummary,
  type StatsUpload,
} from '@/lib/stats-summary';

import { clearFinishedUsage, dropUsage, finishedUsage, viewedCareers } from './usage';

import type { LocalRuntime } from './runtime';

/**
 * What this profile has already sent (kept on the device, deleted with it): result ids for summaries,
 * `path:<group>` for checked paths and `rating` for the results rating.
 */
export const statsKey = (profileId: string) => `stats:${profileId}`;

type Post = (summary: unknown) => Promise<boolean>;

const postSummary: Post = async (summary) => {
  try {
    const res = await fetch('/api/stats', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(summary) });
    return res.ok;
  } catch {
    return false;
  }
};

type SyncOutcome = 'sent' | 'skipped' | 'failed';

/** What the journey screens know that the stored records don't: Discover progress (for milestones). */
export interface SyncContext {
  discover?: { done: boolean[]; next: number | null; doneCount: number; required: number };
  hasResult?: boolean;
}

/** The coarse sender fields every anonymous record carries (age band, stage, language, session code). */
export async function statsSender(rt: LocalRuntime): Promise<StatsSender | null> {
  const profile = (await rt.device.getProfile(rt.userId)) ?? rt.profile;
  if (!profile.ageBand || profile.ageBand === 'under15') return null;
  const result = await rt.service.getLatestResult(rt.userId).catch(() => null);
  const raw = (result?.context as { stage?: unknown } | null | undefined)?.stage;
  const stage: StatsSummary['stage'] = STAGES.find((x) => x === raw) ?? null;
  return { v: 1, ageBand: profile.ageBand, stage, locale: profile.locale, eventCode: profile.event?.code?.toUpperCase() ?? null };
}

export interface JourneyStep {
  key: string;
  step: (typeof STEPS)[number];
  n?: number;
  group?: string;
  career?: string;
}

/** Milestones reached, each with the key it is sent under once (docs/product/analytics.md). Pure. */
export function journeySteps(journey: JourneyDoc, ctx: SyncContext = {}): JourneyStep[] {
  const out: JourneyStep[] = [];
  ctx.discover?.done.forEach((d, i) => d && out.push({ key: `step:discover_task:${i + 1}`, step: 'discover_task', n: i + 1 }));
  if (ctx.discover && ctx.discover.next === null && ctx.discover.doneCount >= ctx.discover.required) out.push({ key: 'step:discover_done', step: 'discover_done' });
  if (ctx.hasResult) out.push({ key: 'step:results_viewed', step: 'results_viewed' });
  for (const [group, rec] of Object.entries(journey.paths)) if (Object.keys(rec.answers).length || rec.result) out.push({ key: `step:path_started:${group}`, step: 'path_started', group });
  for (const [career, rec] of Object.entries(journey.careers ?? {})) {
    if (Object.keys(rec.answers).length || rec.result) out.push({ key: `step:quest_started:${career}`, step: 'quest_started', career });
    if (rec.result) out.push({ key: `step:quest_done:${career}`, step: 'quest_done', career });
  }
  for (const career of journey.selectedCareers ?? []) out.push({ key: `step:career_chosen:${career}`, step: 'career_chosen', career });
  if (journey.situation) out.push({ key: 'step:situation_answered', step: 'situation_answered' });
  return out;
}

/** One sync per profile at a time: overlapping calls (finish + hub, React dev double effects) share it. */
const inflight = new Map<string, Promise<SyncOutcome>>();

/**
 * Sends, once each and only if the profile opted in: the anonymous summary for the latest result, a
 * record for each checked path (its first result) and the results rating. Called after a result, after
 * the rating and whenever a journey tab opens, so anything that failed offline is sent later. Never throws.
 */
export function syncStats(rt: LocalRuntime, post: Post = postSummary, ctx: SyncContext = {}): Promise<SyncOutcome> {
  const running = inflight.get(rt.userId);
  if (running) return running;
  const run = syncOnce(rt, post, ctx).finally(() => inflight.delete(rt.userId));
  inflight.set(rt.userId, run);
  return run;
}

async function syncOnce(rt: LocalRuntime, post: Post, ctx: SyncContext): Promise<SyncOutcome> {
  try {
    const profile = (await rt.device.getProfile(rt.userId)) ?? rt.profile;
    if (!profile.consent?.stats || !profile.ageBand || profile.ageBand === 'under15') {
      // Statistics are off: counts kept in the browser are dropped, never sent later.
      if (typeof window !== 'undefined') dropUsage();
      return 'skipped';
    }
    const kv = rt.device.kv;
    const [result, journey] = await Promise.all([rt.service.getLatestResult(rt.userId), readJourney(kv, rt.userId)]);
    // The stage as it was when the result was made (the context station), if it was answered.
    const raw = (result?.context as { stage?: unknown } | null | undefined)?.stage;
    const stage: StatsSummary['stage'] = STAGES.find((s) => s === raw) ?? null;
    const sender: StatsSender = { v: 1, ageBand: profile.ageBand, stage, locale: profile.locale, eventCode: profile.event?.code?.toUpperCase() ?? null };

    const pending: { key: string; upload: () => StatsUpload }[] = [];
    if (result)
      pending.push({
        key: result.id,
        upload: () =>
          buildStatsSummary({ result: { scores: result.scores as Record<string, unknown>, matches: result.matches }, ...sender }),
      });
    for (const [group, rec] of Object.entries(journey.paths))
      if (rec.result) pending.push({ key: `path:${group}`, upload: () => statsPathSchema.parse({ ...sender, kind: 'path', group, band: rec.result!.band }) });
    if (journey.rating) pending.push({ key: 'rating', upload: () => statsRatingSchema.parse({ ...sender, kind: 'rating', rating: journey.rating!.value }) });
    // First plays of the ranked games, for the comparison with other players (patience isn't ranked).
    for (const [game, rec] of Object.entries(journey.games ?? {}))
      if (game !== 'patience' && rec)
        pending.push({ key: `game:${game}`, upload: () => statsGameSchema.parse({ ...sender, kind: 'game', game, gameVersion: 1, score: rec.points }) });

    // Milestones, career pages opened and earlier days' action counts (docs/product/analytics.md).
    for (const st of journeySteps(journey, ctx))
      pending.push({ key: st.key, upload: () => statsStepSchema.parse({ ...sender, kind: 'step', step: st.step, n: st.n ?? null, group: st.group ?? null, career: st.career ?? null }) });
    if (typeof window !== 'undefined') {
      for (const career of viewedCareers()) pending.push({ key: `view:${career}`, upload: () => statsViewSchema.parse({ ...sender, kind: 'view', career }) });
      const usage = finishedUsage();
      if (usage) pending.push({ key: `usage:${usage.day}`, upload: () => statsUsageSchema.parse({ ...sender, kind: 'usage', counts: usage.counts }) });
    }

    const sent = (await kv.get<string[]>(statsKey(rt.userId))) ?? [];
    let outcome: SyncOutcome = 'skipped';
    for (const { key, upload } of pending) {
      if (sent.includes(key)) continue;
      if (!(await post(upload()))) {
        outcome = 'failed';
        continue;
      }
      sent.push(key);
      await kv.set(statsKey(rt.userId), sent);
      if (key.startsWith('usage:')) clearFinishedUsage();
      if (outcome === 'skipped') outcome = 'sent';
    }
    return outcome;
  } catch {
    return 'failed';
  }
}
