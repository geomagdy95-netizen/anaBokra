import { MemoryAssessmentRepo } from './memory-repo';
import type { AssessmentRepo } from './types';

/**
 * DEV-ONLY mock mode: `ASSESSMENT_REPO=memory` wires the in-memory repo and a fake signed-in
 * student so the whole assessment can be played without Supabase.
 *
 * Hard rule: this is never enabled when NODE_ENV is "production" (the env var is ignored there,
 * not honoured). State lives in the Node process and is lost on restart.
 */
export function isMockMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ASSESSMENT_REPO === 'memory' && env.NODE_ENV !== 'production';
}

export const MOCK_USER_ID = 'a11ce000-0000-4000-8000-0000000000d1';

export interface MockProfile {
  gender: 'female' | 'male' | null;
  governorate: string | null;
}

interface MockState {
  repo: MemoryAssessmentRepo;
  profile: MockProfile;
}

const KEY = Symbol.for('anabokra.assessment.mock');
type Holder = typeof globalThis & { [KEY]?: MockState };

function fresh(): MockState {
  const repo = new MemoryAssessmentRepo();
  // ASSESSMENT_MOCK_NEEDS_CONSENT=1 starts the fake student as a minor WITHOUT guardian consent (consent flow demo).
  repo.addUser(MOCK_USER_ID, { role: 'student', needsConsent: process.env.ASSESSMENT_MOCK_NEEDS_CONSENT === '1' });
  const g = process.env.ASSESSMENT_MOCK_GENDER;
  return { repo, profile: { gender: g === 'female' || g === 'male' ? g : null, governorate: null } };
}

/** One shared instance per Node process (survives dev hot reloads, shared by pages and API routes). */
function state(): MockState {
  const h = globalThis as Holder;
  return (h[KEY] ??= fresh());
}

export const getMockRepo = (): AssessmentRepo => state().repo;
/** The concrete memory repo: the consent mock flips its consent flag so the real gate logic runs. */
export const getMockMemoryRepo = (): MemoryAssessmentRepo => state().repo;
export const getMockProfile = (): MockProfile => state().profile;

/** Drop all mock data (new empty repo, gender back to the env default). */
export function resetMock(patch: Partial<MockProfile> = {}) {
  const h = globalThis as Holder;
  h[KEY] = fresh();
  Object.assign(h[KEY].profile, patch);
}
