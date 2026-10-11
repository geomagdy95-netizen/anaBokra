import { AssessmentError } from '@/server/assessment/errors';

import type { ResponseItem } from './api';
import { SaveFailure } from './save-queue';

/** Same calls as the HTTP client, answered by the assessment service running on the device. */
async function withRuntime<T>(fn: (rt: import('@/lib/local/runtime').LocalRuntime) => Promise<T>): Promise<T> {
  const { activeRuntime } = await import('@/lib/local/runtime');
  const rt = await activeRuntime();
  if (!rt) throw new SaveFailure('consent_required', false, 'consent_required');
  try {
    return await fn(rt);
  } catch (e) {
    if (e instanceof SaveFailure) throw e;
    if (e instanceof AssessmentError) throw new SaveFailure(e.code, false, e.code);
    // Storage failures (quota, blocked IndexedDB) may pass; let the save queue retry.
    throw new SaveFailure('storage', true, 'storage');
  }
}

export const localAssessmentApi = {
  saveResponses: (sessionId: string, station: string, responses: ResponseItem[], cursor?: Record<string, unknown>) =>
    withRuntime((rt) => rt.service.saveResponses(rt.userId, { sessionId, station, responses, ...(cursor ? { cursor } : {}) })),
  saveContext: (sessionId: string, context: Record<string, unknown>) =>
    withRuntime((rt) => rt.service.saveContext(rt.userId, { sessionId, context })),
  saveGovernorate: (governorate: string | null) => withRuntime((rt) => rt.device.updateProfile(rt.userId, { governorate })),
  completeStation: (sessionId: string, station: string, valuesRanking?: string[]) =>
    withRuntime((rt) => rt.service.completeStation(rt.userId, { sessionId, station, ...(valuesRanking ? { valuesRanking } : {}) })),
  saveReadiness: (sessionId: string, answers: Record<string, number>) =>
    withRuntime((rt) => rt.service.saveReadiness(rt.userId, { phase: 'post', sessionId, answers })),
  finalize: (sessionId: string) =>
    withRuntime(async (rt) => {
      const result = await rt.service.finalize(rt.userId, { sessionId });
      // Opt-in anonymous statistics; never blocks or fails the result.
      void import('@/lib/local/stats').then(({ syncStats }) => syncStats(rt));
      return result;
    }),
};
