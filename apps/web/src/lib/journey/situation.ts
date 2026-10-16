import type { KvStore } from '@/lib/local/kv';

import { journeyKey, readJourney } from './verify';

/** How far the family can stretch for study: public universities only, some fees, or private fees. */
export type Budget = 'public' | 'some' | 'private';
/** Where the user lives, coarsely (enough to know whether Cairo-based routes mean travel or moving). */
export type Region = 'cairo' | 'alex' | 'delta' | 'canal' | 'upper' | 'frontier';

/** The user's own circumstances, all optional, kept on the device only. */
export interface Situation {
  budget?: Budget;
  region?: Region;
  /** Needs to earn money while studying. */
  work?: boolean;
  at: string;
}

export const BUDGETS: Budget[] = ['public', 'some', 'private'];
export const REGIONS: Region[] = ['cairo', 'alex', 'delta', 'canal', 'upper', 'frontier'];

/** Saves (or, with null, forgets) the user's circumstances. */
export async function saveSituation(kv: KvStore, profileId: string, s: Omit<Situation, 'at'> | null, now = new Date()): Promise<void> {
  const doc = await readJourney(kv, profileId);
  const { situation: _drop, ...rest } = doc;
  void _drop;
  await kv.set(journeyKey(profileId), s ? { ...rest, situation: { ...s, at: now.toISOString() } } : rest);
}

/**
 * Which of a career's hurdles weigh more for this user. Pure. Cost: any notable cost when the family
 * can only afford public study, the steepest ones when it can stretch a little. Location: when the user
 * lives outside Greater Cairo. Years of study: when the user needs to work while studying.
 */
export function affecting(s: Situation | undefined, hurdles: readonly { kind: string; level: number }[]): Set<string> {
  const out = new Set<string>();
  if (!s) return out;
  for (const h of hurdles) {
    if (h.kind === 'cost' && ((s.budget === 'public' && h.level >= 2) || (s.budget === 'some' && h.level === 3))) out.add('cost');
    if (h.kind === 'location' && s.region && s.region !== 'cairo') out.add('location');
    if (h.kind === 'time' && s.work) out.add('time');
  }
  return out;
}
