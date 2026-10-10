import { describe, expect, it } from 'vitest';

import { FAMILY_CHECK, REQUIRED_CHECKS } from './constants';
import { MemoryConsentRepo } from './memory-repo';
import { OutboxMessenger } from './messenger';
import { createConsentService } from './service';
import { hashToken } from './token';
import { ConsentError } from './types';

const TEEN = '00000000-0000-4000-8000-0000000000a1';
const PARENT = '00000000-0000-4000-8000-0000000000b1';
const STRANGER = '00000000-0000-4000-8000-0000000000b2';
const ADMIN = '00000000-0000-4000-8000-0000000000c1';
const ORG = '00000000-0000-4000-8000-0000000000d1';
const PARENT_PHONE = '+201005550001';
const ALL = [...REQUIRED_CHECKS, 'analytics'];

function setup() {
  let t = new Date('2026-10-09T10:00:00Z').getTime();
  const clock = { now: () => new Date(t), advance: (ms: number) => (t += ms) };
  const activity: [string, boolean][] = [];
  const repo = new MemoryConsentRepo({ now: clock.now, onActiveChange: (id, on) => activity.push([id, on]) });
  repo.addPerson({ id: TEEN, role: 'student', name: 'Sara Ahmed', dob: '2011-04-02' });
  repo.addPerson({ id: PARENT, role: 'parent', phone: PARENT_PHONE });
  repo.addPerson({ id: STRANGER, role: 'parent', phone: '+201005550009' });
  repo.addPerson({ id: ADMIN, role: 'school_admin', name: 'Principal' });
  repo.addOrg({ id: ORG, name: 'Nile School', staff: [ADMIN], code: 'CLASS123', cohort: '10A' });
  const messenger = new OutboxMessenger();
  let n = 0;
  const service = createConsentService({
    repo,
    messenger,
    now: clock.now,
    origin: 'https://anabokra.test',
    newToken: () => `tok${String(++n).padStart(40, '0')}`, // 43 chars, deterministic
  });
  const tokenOf = (kind: 'consent_invite' = 'consent_invite') => /\/consent\/(\S+)/.exec(messenger.last(kind)!.text)![1]!;
  return { repo, service, messenger, clock, activity, tokenOf };
}
const guardian = { userId: PARENT, phone: PARENT_PHONE };
const form = { name: 'Mona Ahmed', relation: 'mother' as const, checks: ALL };
const ctx = { locale: 'ar' as const };
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: unknown) => (e instanceof ConsentError ? e.code : `other:${String(e)}`));

describe('teen-initiated route (A): invite', () => {
  it('stores only the hash and sends the locale link over WhatsApp', async () => {
    const { service, repo, messenger, tokenOf } = setup();
    const view = await service.askParent(TEEN, { phone: '010 0555 0001', hint: 'mother', locale: 'ar' });
    expect(view).toMatchObject({ status: 'pending', maskedPhone: expect.stringContaining('0001'), resendsLeft: 3 });
    expect(view.sentAt).not.toBeNull();

    const token = tokenOf();
    const msg = messenger.last('consent_invite')!;
    expect(msg.phone).toBe(PARENT_PHONE);
    expect(msg.params).toEqual(['Sara', `https://anabokra.test/ar/consent/${token}`]);
    expect(msg.text).toContain('أنا بكرة');
    expect(msg.text).toContain('Sara');
    // only the hash is persisted; the raw token appears nowhere in the stored record
    const stored = repo.invites[0] as unknown as Record<string, unknown>;
    expect(stored.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  it('sends English text for English locale and rejects bad numbers', async () => {
    const { service, messenger } = setup();
    expect(await code(service.askParent(TEEN, { phone: '12345', locale: 'en' }))).toBe('invalid_phone');
    await service.askParent(TEEN, { phone: '+201005550001', locale: 'en' });
    expect(messenger.last()!.text).toMatch(/^Hello\. This is anaBokra/);
    expect(messenger.last()!.text).toContain('https://anabokra.test/en/consent/');
  });

  it('expires after 7 days', async () => {
    const { service, clock, tokenOf, repo } = setup();
    await service.askParent(TEEN, { phone: PARENT_PHONE, locale: 'ar' });
    const token = tokenOf();
    clock.advance(7 * 86_400_000 - 1000);
    expect((await service.peekInvite(token, 'ar')).status).toBe('pending');
    clock.advance(2000);
    expect((await service.peekInvite(token, 'ar')).status).toBe('expired');
    expect(await code(service.confirm(token, guardian, form, ctx))).toBe('invalid_token');
    expect(repo.consents).toHaveLength(0);
    expect((await service.teenStatus(TEEN)).invite?.status).toBe('expired');
  });

  it('limits resends to 3 per rolling day and each resend replaces the link', async () => {
    const { service, clock, tokenOf, messenger } = setup();
    const first = await service.askParent(TEEN, { phone: PARENT_PHONE, locale: 'ar' });
    const firstToken = tokenOf();
    let view = first;
    for (let i = 0; i < 3; i++) view = await service.resend(TEEN, first.id, 'ar');
    expect(view.resendsLeft).toBe(0);
    expect(messenger.sent).toHaveLength(4);
    expect(tokenOf()).not.toBe(firstToken);
    expect(await code(service.peekInvite(firstToken, 'ar'))).toBe('invalid_token'); // old link is dead
    expect((await service.peekInvite(tokenOf(), 'ar')).status).toBe('pending');
    expect(await code(service.resend(TEEN, first.id, 'ar'))).toBe('resend_limit');
    expect(messenger.sent).toHaveLength(4); // nothing was sent on the refused attempt
    clock.advance(24 * 3_600_000 + 1000);
    expect((await service.resend(TEEN, first.id, 'ar')).status).toBe('pending');
  });

  it('change number revokes the old invite and the old link; daily invite cap applies', async () => {
    const { service, tokenOf, repo } = setup();
    const a = await service.askParent(TEEN, { phone: PARENT_PHONE, hint: 'mother', locale: 'ar' });
    const oldToken = tokenOf();
    const b = await service.changeNumber(TEEN, a.id, { phone: '01005550002', locale: 'ar' });
    expect(b.id).not.toBe(a.id);
    expect(b.hint).toBe('mother');
    expect(await code(service.peekInvite(oldToken, 'ar'))).toBe('ok'); // lookup works, but it is revoked:
    expect((await service.peekInvite(oldToken, 'ar')).status).toBe('revoked');
    expect(repo.invites.filter((i) => !i.revokedAt)).toHaveLength(1);
    expect(await code(service.resend(TEEN, a.id, 'ar'))).toBe('conflict');
    for (let i = 0; i < 4; i++) await service.askParent(TEEN, { phone: PARENT_PHONE, locale: 'ar' });
    expect(await code(service.askParent(TEEN, { phone: PARENT_PHONE, locale: 'ar' }))).toBe('invite_limit');
  });

  it('only the owner can resend / change an invite', async () => {
    const { service } = setup();
    const a = await service.askParent(TEEN, { phone: PARENT_PHONE, locale: 'ar' });
    expect(await code(service.resend(STRANGER, a.id, 'ar'))).toBe('not_found');
    expect(await code(service.changeNumber(STRANGER, a.id, { phone: PARENT_PHONE, locale: 'ar' }))).toBe('not_found');
  });
});

describe('guardian landing (J1/J2): pending -> opened -> granted | declined', () => {
  it('peek has no side effects; open marks opened; the teen sees it', async () => {
    const { service, tokenOf } = setup();
    await service.askParent(TEEN, { phone: PARENT_PHONE, locale: 'ar' });
    const token = tokenOf();
    await service.peekInvite(token, 'ar');
    expect((await service.teenStatus(TEEN)).invite).toMatchObject({ status: 'pending', openedAt: null });
    const open = await service.openInvite(token, 'ar');
    expect(open).toMatchObject({ status: 'opened', teen: 'Sara' });
    expect(open.maskedPhone).not.toContain(PARENT_PHONE);
    expect((await service.teenStatus(TEEN)).invite).toMatchObject({ status: 'opened' });
  });

  it('every bad token fails the same way', async () => {
    const { service } = setup();
    for (const bad of ['', 'nope', 'x'.repeat(43), "' or 1=1 --"]) expect(await code(service.peekInvite(bad, 'ar'))).toBe('invalid_token');
  });

  it('grant: needs every required box, the invited number, and records route teen_invite + link + gate', async () => {
    const { service, tokenOf, repo, activity } = setup();
    await service.askParent(TEEN, { phone: PARENT_PHONE, locale: 'ar' });
    const token = tokenOf();
    await service.openInvite(token, 'ar');
    expect((await service.gateState(TEEN)).locked).toBe(true);

    for (const missing of REQUIRED_CHECKS) {
      expect(await code(service.confirm(token, guardian, { ...form, checks: ALL.filter((c) => c !== missing) }, ctx))).toBe('checks_required');
    }
    expect(await code(service.confirm(token, guardian, { ...form, checks: [] }, ctx))).toBe('checks_required');
    expect(await code(service.confirm(token, { userId: STRANGER, phone: '+201005550009' }, form, ctx))).toBe('phone_mismatch');
    expect(await code(service.confirm(token, guardian, { ...form, name: ' ' }, ctx))).toBe('invalid_input');
    expect(await code(service.confirm(token, guardian, { ...form, relation: 'cousin' as never }, ctx))).toBe('invalid_input');
    expect(repo.consents).toHaveLength(0);

    const consent = await service.confirm(token, guardian, { ...form, checks: [...REQUIRED_CHECKS] }, { locale: 'ar', userAgent: 'UA' });
    expect(consent).toMatchObject({
      route: 'teen_invite',
      method: 'whatsapp_link',
      studentId: TEEN,
      guardianName: 'Mona Ahmed',
      guardianRelation: 'mother',
      guardianUserId: PARENT,
      policyVersion: 'consent-0.1-draft',
      scope: ['assessment', 'data_processing'],
      withdrawnAt: null,
    });
    expect(repo.links).toEqual([{ parentId: PARENT, studentId: TEEN, active: true }]);
    expect((await service.gateState(TEEN)).locked).toBe(false);
    expect(activity).toEqual([[TEEN, true]]);
    expect((await service.teenStatus(TEEN)).invite?.status).toBe('granted');
    expect(await code(service.confirm(token, guardian, form, ctx))).toBe('invalid_token'); // single use
  });

  it('thanks the parent on WhatsApp after the grant (best effort)', async () => {
    const { service, tokenOf, messenger } = setup();
    await service.askParent(TEEN, { phone: PARENT_PHONE, locale: 'ar' });
    await service.confirm(tokenOf(), guardian, form, { locale: 'en' });
    expect(messenger.last('consent_granted')).toMatchObject({ phone: PARENT_PHONE, locale: 'en' });
    expect(messenger.last('consent_granted')!.text).toContain('/en/family');
  });

  it('decline is final and collects nothing', async () => {
    const { service, tokenOf, repo } = setup();
    await service.askParent(TEEN, { phone: PARENT_PHONE, locale: 'ar' });
    const token = tokenOf();
    expect((await service.decline(token, 'ar')).status).toBe('declined');
    expect(await code(service.confirm(token, guardian, form, ctx))).toBe('invalid_token');
    expect(await code(service.decline(token, 'ar'))).toBe('conflict');
    expect(await code(service.invitedPhone(token))).toBe('invalid_token');
    expect(repo.consents).toHaveLength(0);
    expect((await service.gateState(TEEN)).locked).toBe(true);
    // the teen can ask again after a decline
    expect((await service.askParent(TEEN, { phone: PARENT_PHONE, locale: 'ar' })).status).toBe('pending');
  });
});

describe('parent-initiated route (B)', () => {
  const child = { name: 'Omar Hassan', dob: '2012-05-05', school: 'Nile School', teenPhone: '01005559999', relation: 'father', guardianName: 'Hassan Ali', checks: [...ALL, FAMILY_CHECK], locale: 'ar' as const };

  it('records consent at creation with route parent_account and invites the teen', async () => {
    const { service, repo, messenger, activity } = setup();
    const { studentId, consent } = await service.addChild({ userId: PARENT, phone: PARENT_PHONE }, child, { userAgent: 'UA' });
    expect(consent).toMatchObject({ route: 'parent_account', method: 'in_app', guardianUserId: PARENT, guardianName: 'Hassan Ali', guardianRelation: 'father', studentId });
    expect(repo.people.get(studentId)).toMatchObject({ name: 'Omar Hassan', dob: '2012-05-05', school: 'Nile School', phone: '+201005559999', claimed: false });
    expect(repo.links).toContainEqual({ parentId: PARENT, studentId, active: true });
    expect(messenger.last('child_claim')).toMatchObject({ phone: '+201005559999' });
    expect(messenger.last('child_claim')!.text).toContain('Hassan Ali');
    expect(activity).toContainEqual([studentId, true]);
    const kids = await service.listChildren(PARENT);
    expect(kids).toHaveLength(1);
    expect(kids[0]).toMatchObject({ name: 'Omar Hassan', claimed: false });
    expect(kids[0]!.consent?.id).toBe(consent.id);
  });

  it('needs the family box too, a valid DOB (10-17) and a teen number', async () => {
    const { service } = setup();
    const p = { userId: PARENT, phone: PARENT_PHONE };
    expect(await code(service.addChild(p, { ...child, checks: ALL }))).toBe('checks_required');
    expect(await code(service.addChild(p, { ...child, dob: '2000-01-01' }))).toBe('invalid_input');
    expect(await code(service.addChild(p, { ...child, dob: '2025-01-01' }))).toBe('invalid_input');
    expect(await code(service.addChild(p, { ...child, dob: '2012-02-31' }))).toBe('invalid_input');
    expect(await code(service.addChild(p, { ...child, teenPhone: 'abc' }))).toBe('invalid_phone');
    expect(await code(service.addChild(p, { ...child, teenPhone: PARENT_PHONE }))).toBe('invalid_input');
    expect(await code(service.addChild(p, { ...child, relation: 'uncle' }))).toBe('invalid_input');
  });

  it('refuses a number that already has an account', async () => {
    const { service } = setup();
    const p = { userId: PARENT, phone: PARENT_PHONE };
    await service.addChild(p, child);
    expect(await code(service.addChild(p, { ...child, name: 'Twin' }))).toBe('conflict');
  });
});

describe('school route (C)', () => {
  it('joins with a class code, then staff record a school-route consent', async () => {
    const { service, repo, activity } = setup();
    expect(await code(service.joinClass(TEEN, 'nope'))).toBe('invalid_class_code');
    expect(await code(service.joinClass(TEEN, 'ZZZZZZ99'))).toBe('invalid_class_code');
    expect(await service.joinClass(TEEN, ' class123 ')).toMatchObject({ organizationName: 'Nile School', cohort: '10A' });
    expect(repo.consents).toHaveLength(0); // joining grants nothing
    expect((await service.gateState(TEEN)).locked).toBe(true);

    const view = await service.schoolView(ADMIN);
    expect(view?.students).toMatchObject([{ studentId: TEEN, name: 'Sara Ahmed', cohort: '10A', consent: null }]);
    expect(await service.schoolView(PARENT)).toBeNull();

    const base = { organizationId: ORG, studentId: TEEN, method: 'paper_form', representativeName: 'Principal Adel', confirmed: true, locale: 'ar' as const };
    expect(await code(service.recordSchoolConsent(ADMIN, { ...base, confirmed: false }))).toBe('checks_required');
    expect(await code(service.recordSchoolConsent(ADMIN, { ...base, method: 'oral' }))).toBe('invalid_input');
    expect(await code(service.recordSchoolConsent(PARENT, base))).toBe('forbidden');
    const consent = await service.recordSchoolConsent(ADMIN, base);
    expect(consent).toMatchObject({ route: 'school', method: 'paper_form', guardianRelation: 'school', organizationId: ORG, guardianUserId: null });
    expect(activity).toContainEqual([TEEN, true]);
    expect((await service.gateState(TEEN)).locked).toBe(false);
    expect((await service.schoolView(ADMIN))!.students[0]!.consent?.id).toBe(consent.id);
  });

  it('cannot record consent for a student who has not joined the school', async () => {
    const { service } = setup();
    expect(await code(service.recordSchoolConsent(ADMIN, { organizationId: ORG, studentId: TEEN, method: 'paper_form', representativeName: 'Principal', confirmed: true, locale: 'ar' }))).toBe('forbidden');
  });

  it('staff can create class codes that work', async () => {
    const { service } = setup();
    const view = (await service.schoolView(ADMIN))!;
    const { code: fresh } = await service.createJoinCode(ADMIN, view.organizationId, '11B');
    expect(fresh).toMatch(/^[A-Z0-9]{8}$/);
    expect(await service.joinClass(TEEN, fresh)).toMatchObject({ cohort: '11B' });
    expect(await code(service.createJoinCode(PARENT, view.organizationId, null))).toBe('forbidden');
  });
});

describe('withdrawal (J8)', () => {
  const grant = async (s: ReturnType<typeof setup>) => {
    await s.service.askParent(TEEN, { phone: PARENT_PHONE, locale: 'ar' });
    return s.service.confirm(s.tokenOf(), guardian, form, ctx);
  };

  it('the granting guardian withdraws: gate closes, the UI is told what was paused/locked, parent is notified', async () => {
    const s = setup();
    const consent = await grant(s);
    const out = await s.service.withdraw({ userId: PARENT, phone: PARENT_PHONE, locale: 'en' }, consent.id, '  changed my mind ');
    expect(out.effects).toEqual({ assessmentPaused: true, featuresLocked: true, stillCovered: false });
    expect(out.consent).toMatchObject({ withdrawnReason: 'changed my mind' });
    expect(out.consent.withdrawnAt).not.toBeNull();
    expect((await s.service.gateState(TEEN)).locked).toBe(true);
    expect(s.activity.at(-1)).toEqual([TEEN, false]);
    expect(s.messenger.last('consent_withdrawn')).toMatchObject({ phone: PARENT_PHONE, locale: 'en' });
    expect((await s.service.listGuardianConsents(PARENT))[0]!.withdrawnAt).not.toBeNull();
  });

  it('is idempotent and withdrawal is final (re-consent is a NEW record)', async () => {
    const s = setup();
    const consent = await grant(s);
    const a = await s.service.withdraw({ userId: PARENT, locale: 'ar' }, consent.id, null);
    const b = await s.service.withdraw({ userId: PARENT, locale: 'ar' }, consent.id, 'later');
    expect(b.consent.withdrawnAt).toBe(a.consent.withdrawnAt);
    expect(b.consent.withdrawnReason).toBeNull();
    await s.service.askParent(TEEN, { phone: PARENT_PHONE, locale: 'ar' });
    const again = await s.service.confirm(s.tokenOf(), guardian, form, ctx);
    expect(again.id).not.toBe(consent.id);
    expect((await s.service.gateState(TEEN)).locked).toBe(false);
  });

  it('strangers cannot withdraw; the student and school admins can', async () => {
    const s = setup();
    const consent = await grant(s);
    expect(await code(s.service.withdraw({ userId: STRANGER, locale: 'ar' }, consent.id, null))).toBe('forbidden');
    expect(await code(s.service.withdraw({ userId: PARENT, locale: 'ar' }, '00000000-0000-4000-8000-00000000ffff', null))).toBe('not_found');
    expect((await s.service.withdraw({ userId: TEEN, locale: 'ar' }, consent.id, null)).consent.withdrawnAt).not.toBeNull();

    await s.service.joinClass(TEEN, 'CLASS123');
    const school = await s.service.recordSchoolConsent(ADMIN, { organizationId: ORG, studentId: TEEN, method: 'paper_form', representativeName: 'Principal', confirmed: true, locale: 'ar' });
    expect((await s.service.withdraw({ userId: ADMIN, locale: 'ar' }, school.id, null)).effects.assessmentPaused).toBe(true);
  });

  it('keeps the gate open while another consent still covers the student', async () => {
    const s = setup();
    const first = await grant(s);
    await s.service.joinClass(TEEN, 'CLASS123');
    await s.service.recordSchoolConsent(ADMIN, { organizationId: ORG, studentId: TEEN, method: 'paper_form', representativeName: 'Principal', confirmed: true, locale: 'ar' });
    const out = await s.service.withdraw({ userId: PARENT, locale: 'ar' }, first.id, null);
    expect(out.effects).toEqual({ assessmentPaused: false, featuresLocked: false, stillCovered: true });
    expect((await s.service.gateState(TEEN)).locked).toBe(false);
  });

  it('adults are never gated', async () => {
    const s = setup();
    s.repo.addPerson({ id: '00000000-0000-4000-8000-0000000000a9', role: 'student', name: 'Adult', dob: '2000-01-01' });
    expect(await s.service.gateState('00000000-0000-4000-8000-0000000000a9')).toEqual({ minor: false, locked: false });
  });
});
