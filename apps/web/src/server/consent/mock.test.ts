import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MOCK_USER_ID, getMockRepo, resetMock } from '../assessment/mock';

import { MOCK_CLASS_CODE, MOCK_PARENT_ID, getMockConsentRepo, getMockOutbox, mockGuardianAuth, resetConsentMock } from './mock';
import { MOCK_OTP, REQUIRED_CHECKS } from './constants';
import { createConsentService } from './service';
import { hashToken } from './token';

describe('mock consent flow (ASSESSMENT_REPO=memory)', () => {
  beforeEach(() => {
    vi.stubEnv('ASSESSMENT_REPO', 'memory');
    vi.stubEnv('ASSESSMENT_MOCK_NEEDS_CONSENT', '1');
    resetMock();
    resetConsentMock();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetMock();
    resetConsentMock();
  });

  const svc = () => createConsentService({ repo: getMockConsentRepo(), messenger: getMockOutbox(), origin: 'http://localhost:3000' });

  it('runs invite -> fake OTP -> confirm -> withdraw and flips the real assessment gate', async () => {
    const service = svc();
    const assessment = getMockRepo();
    expect(await assessment.getStartEligibility(MOCK_USER_ID)).toBe('consent_required');

    await service.askParent(MOCK_USER_ID, { phone: '01000000001', locale: 'ar' });
    const token = /\/consent\/(\S+)/.exec(getMockOutbox().last('consent_invite')!.text)![1]!;
    const phone = await service.invitedPhone(token);

    // wrong code is refused, the fixed mock code verifies the parent
    await expect(mockGuardianAuth.verifyCode(phone, '000000', hashToken(token))).rejects.toMatchObject({ code: 'invalid_code' });
    expect(await mockGuardianAuth.current(phone, hashToken(token))).toBeNull();
    const g = await mockGuardianAuth.verifyCode(phone, MOCK_OTP, hashToken(token));
    expect(g.userId).toBe(MOCK_PARENT_ID);
    expect(await mockGuardianAuth.current(phone, hashToken(token))).toEqual(g);

    const consent = await service.confirm(token, g, { name: 'Mock Parent', relation: 'mother', checks: [...REQUIRED_CHECKS] }, { locale: 'ar' });
    expect(await assessment.getStartEligibility(MOCK_USER_ID)).toBe('ok');

    await service.withdraw({ userId: MOCK_PARENT_ID, locale: 'ar' }, consent.id, null);
    expect(await assessment.getStartEligibility(MOCK_USER_ID)).toBe('consent_required');
  });

  it('school route works end to end with the mock class code', async () => {
    const service = svc();
    await service.joinClass(MOCK_USER_ID, MOCK_CLASS_CODE);
    const admin = 'a11ce000-0000-4000-8000-0000000000e2';
    await service.recordSchoolConsent(admin, { organizationId: (await service.schoolView(admin))!.organizationId, studentId: MOCK_USER_ID, method: 'paper_form', representativeName: 'Principal', confirmed: true, locale: 'ar' });
    expect(await getMockRepo().getStartEligibility(MOCK_USER_ID)).toBe('ok');
  });

  it('starts already consented unless ASSESSMENT_MOCK_NEEDS_CONSENT=1', async () => {
    vi.stubEnv('ASSESSMENT_MOCK_NEEDS_CONSENT', '');
    resetMock();
    resetConsentMock();
    expect(await getMockRepo().getStartEligibility(MOCK_USER_ID)).toBe('ok');
    expect((await svc().gateState(MOCK_USER_ID)).locked).toBe(false);
  });
});
