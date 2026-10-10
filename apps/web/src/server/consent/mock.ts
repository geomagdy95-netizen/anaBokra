import { getMockMemoryRepo, isMockMode, MOCK_USER_ID } from '../assessment/mock';

import { MOCK_OTP } from './constants';
import { MemoryConsentRepo } from './memory-repo';
import { OutboxMessenger } from './messenger';
import type { Guardian } from './service';
import { ConsentError } from './types';

/**
 * DEV-ONLY fake consent flow (same switch as the assessment mock: ASSESSMENT_REPO=memory, never in production).
 * - the fake student from the assessment mock is the teen; consent really flips the assessment gate
 * - the parent's OTP step is simulated: the code is always MOCK_OTP (printed in the server log too)
 * - messages go to an in-memory outbox instead of WhatsApp
 * - `mx-mock-role` cookie (student | parent | school_admin) chooses who is "signed in" (see /api/consent/dev/mock)
 */
export const MOCK_PARENT_ID = 'a11ce000-0000-4000-8000-0000000000e1';
export const MOCK_SCHOOL_ADMIN_ID = 'a11ce000-0000-4000-8000-0000000000e2';
export const MOCK_ORG_ID = 'a11ce000-0000-4000-8000-0000000000f1';
export const MOCK_CLASS_CODE = 'MOCK2026';
export const MOCK_ROLES = ['student', 'parent', 'school_admin'] as const;
export type MockRole = (typeof MOCK_ROLES)[number];
export const MOCK_ROLE_COOKIE = 'mx-mock-role';

interface MockConsentState {
  repo: MemoryConsentRepo;
  outbox: OutboxMessenger;
  /** token hash -> guardian verified by the (fake) OTP */
  verified: Map<string, Guardian>;
}

const KEY = Symbol.for('anabokra.consent.mock');
type Holder = typeof globalThis & { [KEY]?: MockConsentState };

function fresh(): MockConsentState {
  const assessment = getMockMemoryRepo();
  const repo = new MemoryConsentRepo({
    onActiveChange: (studentId, active) => {
      try {
        if (active) assessment.grantConsent(studentId);
        else assessment.withdrawConsent(studentId);
      } catch {
        assessment.addUser(studentId, { role: 'student', needsConsent: !active }); // child created in the consent mock
      }
    },
  });
  const year = new Date().getUTCFullYear() - 15;
  repo.addPerson({ id: MOCK_USER_ID, role: 'student', name: process.env.ASSESSMENT_MOCK_NAME ?? 'Sara Ahmed', dob: `${year}-03-01`, locale: 'ar' });
  repo.addPerson({ id: MOCK_PARENT_ID, role: 'parent', name: 'Mock Parent', phone: '+201000000001', locale: 'ar' });
  repo.addPerson({ id: MOCK_SCHOOL_ADMIN_ID, role: 'school_admin', name: 'Mock Principal' });
  repo.addOrg({ id: MOCK_ORG_ID, name: 'Nile Mock School', staff: [MOCK_SCHOOL_ADMIN_ID], code: MOCK_CLASS_CODE, cohort: 'Grade 10A' });
  if (process.env.ASSESSMENT_MOCK_NEEDS_CONSENT !== '1') repo.grantFixture(MOCK_USER_ID, 'parent_account', MOCK_PARENT_ID);
  return { repo, outbox: new OutboxMessenger(), verified: new Map() };
}

const state = (): MockConsentState => ((globalThis as Holder)[KEY] ??= fresh());

export const isConsentMock = isMockMode;
export const getMockConsentRepo = (): MemoryConsentRepo => state().repo;
export const getMockOutbox = (): OutboxMessenger => state().outbox;
export const resetConsentMock = (): void => {
  delete (globalThis as Holder)[KEY];
};

export const mockIdFor = (role: MockRole): string => (role === 'parent' ? MOCK_PARENT_ID : role === 'school_admin' ? MOCK_SCHOOL_ADMIN_ID : MOCK_USER_ID);

/** The mock OTP step: remembers who was verified for which invite. */
export const mockGuardianAuth = {
  async sendCode(phone: string): Promise<void> {
    console.info(`[consent:mock-otp] code for ${phone}: ${MOCK_OTP}`);
  },
  async verifyCode(phone: string, code: string, tokenHash: string): Promise<Guardian> {
    if (code !== MOCK_OTP) throw new ConsentError('invalid_code');
    const repo = state().repo;
    const existing = [...repo.people.values()].find((p) => p.role === 'parent' && p.phone === phone);
    const parent = existing ?? repo.addPerson({ id: `a11ce000-0000-4000-8000-${phone.replace(/\D/g, '').padStart(12, '0').slice(-12)}`, role: 'parent', phone, name: '' });
    const guardian = { userId: parent.id, phone };
    state().verified.set(tokenHash, guardian);
    return guardian;
  },
  async current(phone: string, tokenHash: string): Promise<Guardian | null> {
    const g = state().verified.get(tokenHash);
    return g && g.phone === phone ? g : null;
  },
};
