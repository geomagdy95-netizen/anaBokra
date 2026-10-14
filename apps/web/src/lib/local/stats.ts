import { STAGES } from '@anabokra/engine';

import { readJourney } from '@/lib/journey/verify';
import { buildStatsSummary, statsPathSchema, statsGameSchema, statsRatingSchema, type StatsSender, type StatsSummary, type StatsUpload } from '@/lib/stats-summary';

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

/** One sync per profile at a time: overlapping calls (finish + hub, React dev double effects) share it. */
const inflight = new Map<string, Promise<SyncOutcome>>();

/**
 * Sends, once each and only if the profile opted in: the anonymous summary for the latest result, a
 * record for each checked path (its first result) and the results rating. Called after a result, after
 * the rating and whenever a journey tab opens, so anything that failed offline is sent later. Never throws.
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
      if (outcome === 'skipped') outcome = 'sent';
    }
    return outcome;
  } catch {
    return 'failed';
  }
}
