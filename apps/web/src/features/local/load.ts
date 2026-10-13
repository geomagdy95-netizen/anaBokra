import type { Locale } from '@/i18n/routing';
import { activeRuntime, lockedProfile, type LocalRuntime } from '@/lib/local/runtime';
import { AssessmentError, type AssessmentErrorCode } from '@/server/assessment/errors';
import type { EntryState, ProgressView } from '@/server/assessment/service';

export type LocalPageData =
  | { ok: true; rt: LocalRuntime; sessionId: string; progress: ProgressView }
  | { ok: 'results'; rt: LocalRuntime; entry: Extract<EntryState, { kind: 'results' }> }
  | { ok: 'first-start' }
  | { ok: 'locked'; nickname: string | null }
  | { ok: false; code: AssessmentErrorCode };

/**
 * The device counterpart of server/assessment/page-data.ts: no profile yet means the first-start
 * screens; a profile with a password that isn't unlocked yet means the unlock screen; a finished
 * result with no open session shows that result; otherwise start or resume.
 */
export async function loadLocalAssessment(locale: Locale, { retake = false }: { retake?: boolean } = {}): Promise<LocalPageData> {
  const locked = await lockedProfile();
  if (locked) return { ok: 'locked', nickname: locked.displayName };
  const rt = await activeRuntime();
  if (!rt || !rt.profile.consent) return { ok: 'first-start' };
  try {
    const entry = await rt.service.getEntryState(rt.userId);
    if (entry.kind === 'results' && !(retake && entry.retake.allowed)) return { ok: 'results', rt, entry };
    const started = await rt.service.startSession(rt.userId, { kind: 'full', locale });
    return { ok: true, rt, sessionId: started.session.id, progress: started.progress };
  } catch (e) {
    if (e instanceof AssessmentError) return { ok: false, code: e.code };
    throw e;
  }
}
