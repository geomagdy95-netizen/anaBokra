import { STAGES } from '@anabokra/engine';

import { buildStatsSummary, type StatsSummary } from '@/lib/stats-summary';

import type { LocalRuntime } from './runtime';

/** Which results this profile has already sent statistics for (kept on the device, deleted with it). */
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

/** One sync per profile at a time: overlapping calls (finish + hub, React dev double effects) share it. */
const inflight = new Map<string, Promise<SyncOutcome>>();

/**
 * Sends the anonymous summary for the latest result, once, if the profile opted in. Called after a
 * result is made and again when the hub opens, so an offline finish is sent later. Never throws.
 */
export function syncStats(rt: LocalRuntime, post: Post = postSummary): Promise<SyncOutcome> {
  const running = inflight.get(rt.userId);
  if (running) return running;
  const run = syncOnce(rt, post).finally(() => inflight.delete(rt.userId));
  inflight.set(rt.userId, run);
  return run;
}

async function syncOnce(rt: LocalRuntime, post: Post): Promise<SyncOutcome> {
  try {
    const profile = (await rt.device.getProfile(rt.userId)) ?? rt.profile;
    if (!profile.consent?.stats || !profile.ageBand || profile.ageBand === 'under15') return 'skipped';
    const result = await rt.service.getLatestResult(rt.userId);
    if (!result) return 'skipped';
    const kv = rt.device.kv;
    const sent = (await kv.get<string[]>(statsKey(rt.userId))) ?? [];
    if (sent.includes(result.id)) return 'skipped';
    // The stage as it was when the result was made (the context station), if it was answered.
    const raw = (result.context as { stage?: unknown } | null | undefined)?.stage;
    const stage: StatsSummary['stage'] = STAGES.find((s) => s === raw) ?? null;
    const summary = buildStatsSummary({
      result: { scores: result.scores as Record<string, unknown>, matches: result.matches },
      ageBand: profile.ageBand,
      stage,
      locale: profile.locale,
    });
    if (!(await post(summary))) return 'failed';
    await kv.set(statsKey(rt.userId), [...sent, result.id]);
    return 'sent';
  } catch {
    return 'failed';
  }
}
