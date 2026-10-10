import { careers, type Career } from '@anabokra/content';
import { rankCareers, type CareerMatch, type UserContext, type UserProfile } from '@anabokra/engine';

import type { PersonalFit } from '@/features/careers/types';
import type { StoredMatch } from '@/server/assessment/scoring';

export interface ResultLike {
  scores: Record<string, unknown>;
  matches: unknown[];
  context: UserContext;
}

const toFit = (m: CareerMatch): PersonalFit => ({
  fit: Math.round(m.fit),
  reasons: m.reasons,
  watchOuts: m.watchOuts,
  flags: m.flags,
});

/**
 * Fit for every career, not just the stored top 20: the profile scores are stored on the result, so the
 * whole catalog is re-ranked with the same engine and context. Falls back to the stored matches.
 */
export function fitsFromResult(result: ResultLike, catalog: Career[] = careers): Record<string, PersonalFit> {
  const s = result.scores;
  const profile: UserProfile = {
    ...(s.interests ? { interests: s.interests as UserProfile['interests'] } : {}),
    ...(s.personality ? { personality: s.personality as UserProfile['personality'] } : {}),
    ...(s.values ? { values: s.values as UserProfile['values'] } : {}),
    ...(s.abilities ? { abilities: s.abilities as UserProfile['abilities'] } : {}),
  };
  if (Object.keys(profile).length > 0) {
    try {
      return Object.fromEntries(rankCareers(profile, catalog, { context: result.context ?? {} }).map((m) => [m.careerId, toFit(m)]));
    } catch {
      /* fall through to stored matches */
    }
  }
  return Object.fromEntries((result.matches as StoredMatch[]).map((m) => [m.careerId, toFit(m)]));
}
