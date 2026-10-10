import { EMPTY_PERSONAL, type PersonalData, type PersonalFit } from '@/features/careers/types';
import { getAssessmentRuntime } from '@/server/assessment/runtime';
import { withFavorites } from './favorites';
import { fitsFromResult, type ResultLike } from './fits';

/** Who the caller is, their fit per career and their favorites. Signed-out or any failure => the empty value. */
export async function loadPersonal(): Promise<PersonalData> {
  let fits: Record<string, PersonalFit> = {};
  let signedIn = false;
  try {
    const runtime = await getAssessmentRuntime();
    if (runtime) {
      signedIn = true;
      const latest = await runtime.service.getLatestResult(runtime.userId);
      if (latest) fits = fitsFromResult(latest as ResultLike);
    }
  } catch (e) {
    console.error('[careers] personal fit unavailable', e instanceof Error ? e.message : e);
  }

  const fav = await withFavorites((store) => store.list());
  if (fav.ok) signedIn = true;
  return {
    ...EMPTY_PERSONAL,
    signedIn,
    fits,
    hasResult: Object.keys(fits).length > 0,
    favorites: fav.ok ? fav.value : [],
    favoritesLocked: !fav.ok && fav.code !== 'unauthenticated' ? (fav.code === 'consent_required' ? 'consent_required' : 'unavailable') : null,
  };
}
