import { redirect } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

import { AssessmentError, type AssessmentErrorCode } from './errors';
import { getAssessmentRuntime, type AssessmentRuntime, type StudentProfile } from './runtime';
import type { EntryState, ProgressView } from './service';

export type AssessmentPageData =
  | {
      ok: true;
      runtime: AssessmentRuntime;
      sessionId: string;
      progress: ProgressView;
      profile: StudentProfile;
    }
  | { ok: 'results'; runtime: AssessmentRuntime; profile: StudentProfile; entry: Extract<EntryState, { kind: 'results' }> }
  | { ok: false; code: AssessmentErrorCode };

/**
 * Shared by every assessment page: who is signed in (else go to login), then start the session or
 * resume the open one. Expected refusals (guardian consent, not a student) come back as `ok: false`
 * so the page can explain them instead of crashing.
 */
export async function requireRuntime(locale: Locale, nextPath: string): Promise<AssessmentRuntime> {
  const runtime = await getAssessmentRuntime();
  if (!runtime) return redirect({ href: `/login?next=${encodeURIComponent(nextPath)}`, locale });
  return runtime;
}

/**
 * A student who already has a result and no open session is shown that result (`ok: 'results'`);
 * a new session starts only when `retake` is requested AND the retake window (RETAKE_AFTER_DAYS) has passed.
 */
export async function loadAssessment(locale: Locale, nextPath: string, { retake = false }: { retake?: boolean } = {}): Promise<AssessmentPageData> {
  const runtime = await requireRuntime(locale, nextPath);
  try {
    const entry = await runtime.service.getEntryState(runtime.userId);
    if (entry.kind === 'results' && !(retake && entry.retake.allowed)) return { ok: 'results', runtime, profile: await runtime.profile(), entry };
    const started = await runtime.service.startSession(runtime.userId, { kind: 'full', locale });
    return { ok: true, runtime, sessionId: started.session.id, progress: started.progress, profile: await runtime.profile() };
  } catch (e) {
    if (e instanceof AssessmentError) return { ok: false, code: e.code };
    throw e;
  }
}
