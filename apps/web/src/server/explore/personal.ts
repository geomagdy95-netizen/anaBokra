import type { ExplorePersonal } from '@/features/explore/types';
import { EMPTY_EXPLORE_PERSONAL } from '@/features/explore/types';
import { governorateId } from '@/features/explore/governorates';
import { getAssessmentRuntime } from '@/server/assessment/runtime';

import { withSaved } from './saved';

/** The caller's score context, top careers and saved items. Signed out or any failure => the empty value. */
export async function loadExplorePersonal(): Promise<ExplorePersonal> {
  const out: ExplorePersonal = { ...EMPTY_EXPLORE_PERSONAL };
  try {
    const runtime = await getAssessmentRuntime();
    if (runtime) {
      out.signedIn = true;
      const latest = await runtime.service.getLatestResult(runtime.userId);
      if (latest) {
        const ctx = (latest.context ?? {}) as { track?: string; expectedScorePct?: number; budget?: 'low' | 'medium' | 'high'; curriculum?: string };
        out.hasResult = true;
        out.expectedScorePct = typeof ctx.expectedScorePct === 'number' ? ctx.expectedScorePct : null;
        out.track = ctx.track ?? null;
        out.budget = ctx.budget ?? null;
        out.curriculum = ctx.curriculum ?? null;
        out.topCareerIds = (latest.matches as { careerId: string }[]).slice(0, 5).map((m) => m.careerId);
      }
      try {
        out.governorate = governorateId((await runtime.profile()).governorate) ?? null;
      } catch {
        /* governorate is optional */
      }
    }
  } catch (e) {
    console.error('[explore] personal context unavailable', e instanceof Error ? e.message : e);
  }
  const saved = await withSaved((s) => s.list());
  if (saved.ok) {
    out.signedIn = true;
    out.saved = saved.value;
  } else if (saved.code !== 'unauthenticated') {
    out.savedLocked = saved.code === 'consent_required' ? 'consent_required' : 'unavailable';
  }
  return out;
}
