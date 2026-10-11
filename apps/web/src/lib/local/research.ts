import { instruments } from '@anabokra/content';
import { STAGES } from '@anabokra/engine';

import { researchAnswerSetSchema, researchReadinessSchema, type ResearchAnswerSet, type ResearchReadiness } from '@/lib/research';

import type { LocalProfile } from './device';
import type { LocalRuntime } from './runtime';
import { randomCode } from './transfer';

/**
 * Research uploads from this phone (consent-texts §2.3), only for an adult who joined a pilot session
 * that offers research and said yes. Kept on the device, deleted with the profile:
 * - `linkCode`: random, made here; pairs the before and after readiness answers. Never on an answer set.
 * - what was already sent, so each answer set and readiness record goes once.
 */
export interface ResearchState {
  linkCode: string;
  sentResults: string[];
  sentReadiness: string[];
}

export const researchKey = (profileId: string) => `research:${profileId}`;

export async function researchState(rt: LocalRuntime): Promise<ResearchState> {
  const kv = rt.device.kv;
  const existing = await kv.get<ResearchState>(researchKey(rt.userId));
  if (existing) return existing;
  const fresh: ResearchState = { linkCode: randomCode(26), sentResults: [], sentReadiness: [] };
  await kv.set(researchKey(rt.userId), fresh);
  return fresh;
}

/** Research applies only to adults who said yes at a session that offers it. */
export function researchActive(p: LocalProfile): p is LocalProfile & { event: NonNullable<LocalProfile['event']> } {
  return Boolean(
    p.consent?.research && p.consent.basis === 'adult_self' && p.event?.research && p.ageBand && ['18-20', '21-25', '26plus'].includes(p.ageBand),
  );
}

type Post = (path: string, body: unknown) => Promise<boolean>;

const postJson: Post = async (path, body) => {
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return res.ok;
  } catch {
    return false;
  }
};

type Outcome = 'sent' | 'skipped' | 'failed';
const inflight = new Map<string, Promise<Outcome>>();

/**
 * Sends what has not been sent yet: the answer set of the latest result, and each readiness check.
 * Called after a result, after a readiness check and when the hub opens. Never throws.
 */
export function syncResearch(rt: LocalRuntime, post: Post = postJson): Promise<Outcome> {
  const running = inflight.get(rt.userId);
  if (running) return running;
  const run = syncOnce(rt, post).finally(() => inflight.delete(rt.userId));
  inflight.set(rt.userId, run);
  return run;
}

async function syncOnce(rt: LocalRuntime, post: Post): Promise<Outcome> {
  try {
    const profile = (await rt.device.getProfile(rt.userId)) ?? rt.profile;
    if (!researchActive(profile)) return 'skipped';
    const kv = rt.device.kv;
    const state = await researchState(rt);
    let sent = false;
    let failed = false;

    const result = await rt.service.getLatestResult(rt.userId);
    if (result && !state.sentResults.includes(result.id)) {
      const set = await buildAnswerSet(rt, profile, result);
      if (await post('/api/research/answers', set)) {
        state.sentResults.push(result.id);
        await kv.set(researchKey(rt.userId), state);
        sent = true;
      } else failed = true;
    }

    for (const r of await rt.repo.listReadiness()) {
      const key = `${r.id}:${r.takenAt}`;
      if (state.sentReadiness.includes(key)) continue;
      const rec: ResearchReadiness = researchReadinessSchema.parse({
        v: 1,
        eventCode: profile.event.code,
        linkCode: state.linkCode,
        phase: r.phase,
        version: instruments.readiness.version,
        locale: profile.locale,
        answers: r.answers,
      });
      if (await post('/api/research/readiness', rec)) {
        state.sentReadiness.push(key);
        await kv.set(researchKey(rt.userId), state);
        sent = true;
      } else failed = true;
    }
    return failed ? 'failed' : sent ? 'sent' : 'skipped';
  } catch {
    return 'failed';
  }
}

/** The answers behind one result: item answers per instrument and the values ranking. Nothing else. */
export async function buildAnswerSet(
  rt: LocalRuntime,
  profile: LocalProfile & { event: NonNullable<LocalProfile['event']> },
  result: { sessionId: string; context?: unknown; scores: unknown },
): Promise<ResearchAnswerSet> {
  const responses = await rt.repo.listResponses(result.sessionId);
  const session = await rt.repo.getSession(rt.userId, result.sessionId);
  const progress = (session?.progress ?? {}) as { instrumentVersions?: Record<string, string>; valuesRanking?: string[] };
  const answers: Record<string, Record<string, number>> = {};
  for (const r of responses) {
    if (!['interests', 'personality', 'values', 'abilities'].includes(r.instrumentId)) continue;
    (answers[r.instrumentId] ??= {})[r.itemId] = r.value;
  }
  const versions = Object.fromEntries(Object.entries(progress.instrumentVersions ?? {}).filter(([k]) => k in answers));
  const rawStage = (result.context as { stage?: unknown } | null | undefined)?.stage;
  return researchAnswerSetSchema.parse({
    v: 1,
    eventCode: profile.event.code,
    ageBand: profile.ageBand,
    stage: STAGES.find((s) => s === rawStage) ?? null,
    locale: profile.locale,
    versions,
    answers,
    valuesRanking: progress.valuesRanking ?? [],
  });
}

/**
 * Stops research uploads and asks the server to delete the readiness records sent with this phone's
 * link code. Answer sets carry no key, so they cannot be picked out; they are deleted with the rest
 * of the research data. A new link code is made in case the user joins again.
 */
export async function stopResearch(rt: LocalRuntime, post: Post = postJson): Promise<{ deleted: boolean; hadReadiness: boolean }> {
  const kv = rt.device.kv;
  const state = await kv.get<ResearchState>(researchKey(rt.userId));
  const profile = await rt.device.getProfile(rt.userId);
  if (profile?.consent) await rt.device.updateProfile(rt.userId, { consent: { ...profile.consent, research: false } });
  const hadReadiness = Boolean(state?.sentReadiness.length);
  const deleted = hadReadiness ? await post('/api/research/forget', { linkCode: state!.linkCode }) : true;
  // Keep the old code if the delete did not go through, so it can be retried.
  if (deleted) await kv.delete(researchKey(rt.userId));
  return { deleted, hadReadiness };
}
