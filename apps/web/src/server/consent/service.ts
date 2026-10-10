import { maskPhone, normalizePhone } from '../otp/phone';
import { OtpSendError, type ConsentMessenger, type NoticeMessage, type OtpLocale } from '../otp/types';

import {
  CONSENT_TEXT_VERSION,
  FAMILY_CHECK,
  INVITE_TTL_DAYS,
  MAX_CHILD_AGE,
  MAX_RESENDS_PER_DAY,
  MIN_CHILD_AGE,
  POLICY_VERSION,
  RELATIONS,
  REQUIRED_CHECKS,
  type Relation,
} from './constants';
import { childClaimNotice, grantedNotice, inviteNotice, nickname, withdrawnNotice } from './notices';
import { expiryFrom, inviteStatus, isLive, sendBudget, type InviteStatus } from './state';
import { generateToken, hashToken, isTokenShape } from './token';
import {
  ConsentError,
  type ChildRecord,
  type ConsentRecord,
  type ConsentRepo,
  type Evidence,
  type InviteRecord,
  type InviteView,
  type SchoolView,
} from './types';

export interface ConsentServiceDeps {
  repo: ConsentRepo;
  messenger: ConsentMessenger;
  now?: () => Date;
  newToken?: () => string;
  maxResends?: number;
  /** Absolute public origin for links in WhatsApp messages, e.g. https://anabokra.app (no trailing slash). */
  origin: string;
}

export interface Guardian {
  userId: string;
  /** Verified (OTP) E.164 phone of the guardian account. */
  phone: string;
}

export interface PublicInvite {
  status: InviteStatus;
  teen: string;
  maskedPhone: string;
  expiresAt: string;
}

export interface GuardianForm {
  name: string;
  relation: Relation;
  /** Ticked checkbox ids. */
  checks: string[];
}

const isRelation = (v: unknown): v is Relation => typeof v === 'string' && (RELATIONS as readonly string[]).includes(v);

/** All required boxes ticked; extra/unknown ids are dropped; the optional one is kept if ticked. */
export function validateChecks(checks: unknown, extraRequired: readonly string[] = []): string[] {
  if (!Array.isArray(checks)) throw new ConsentError('checks_required');
  const ticked = new Set(checks.filter((c): c is string => typeof c === 'string'));
  for (const id of [...REQUIRED_CHECKS, ...extraRequired]) if (!ticked.has(id)) throw new ConsentError('checks_required', undefined, { missing: id });
  return [...REQUIRED_CHECKS, ...extraRequired, ...(ticked.has('analytics') ? ['analytics'] : [])];
}

function cleanName(v: unknown, field = 'name'): string {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  if (s.length < 2 || s.length > 100) throw new ConsentError('invalid_input', `${field} must be 2-100 characters`, { field });
  return s;
}

export function ageOn(dob: string, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const birth = new Date(Date.UTC(y, mo - 1, d));
  if (birth.getUTCFullYear() !== y || birth.getUTCMonth() !== mo - 1 || birth.getUTCDate() !== d) return null;
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() < mo - 1 || (now.getUTCMonth() === mo - 1 && now.getUTCDate() < d)) age -= 1;
  return age;
}

export function createConsentService(deps: ConsentServiceDeps) {
  const { repo, messenger } = deps;
  const now = deps.now ?? (() => new Date());
  const newToken = deps.newToken ?? generateToken;
  const maxResends = deps.maxResends ?? MAX_RESENDS_PER_DAY;
  const linkFor = (locale: OtpLocale, token: string) => `${deps.origin.replace(/\/+$/, '')}/${locale}/consent/${token}`;
  const familyLink = (locale: OtpLocale) => `${deps.origin.replace(/\/+$/, '')}/${locale}/family`;

  async function deliver(notice: NoticeMessage): Promise<void> {
    try {
      await messenger.sendNotice(notice);
    } catch (err) {
      if (err instanceof OtpSendError) throw new ConsentError('send_failed', err.message);
      throw err;
    }
  }
  /** Confirmation messages are best-effort: the consent is already recorded. */
  async function tell(notice: NoticeMessage): Promise<void> {
    try {
      await messenger.sendNotice(notice);
    } catch (err) {
      console.error('[consent] notice failed:', notice.kind, err instanceof Error ? err.message : err);
    }
  }

  function view(i: InviteRecord): InviteView {
    const t = now();
    const budget = sendBudget(i.sends, t, maxResends);
    return {
      id: i.id,
      status: inviteStatus(i, t),
      maskedPhone: maskPhone(i.phone),
      hint: i.hint,
      createdAt: i.createdAt,
      expiresAt: i.expiresAt,
      sentAt: i.sends.at(-1) ?? null,
      openedAt: i.openedAt,
      resendsLeft: Math.max(0, budget.remaining),
      retryAt: budget.retryAt?.toISOString() ?? null,
    };
  }

  async function ownLiveInvite(studentId: string, inviteId: string): Promise<InviteRecord> {
    const invite = (await repo.listInvites(studentId)).find((i) => i.id === inviteId);
    if (!invite) throw new ConsentError('not_found');
    if (!isLive(inviteStatus(invite, now()))) throw new ConsentError('conflict', 'invite is no longer active');
    return invite;
  }

  async function sendInvite(invite: InviteRecord, token: string, locale: OtpLocale) {
    await deliver(inviteNotice({ phone: invite.phone, locale, teen: nickname(invite.studentName, locale), link: linkFor(locale, token) }));
  }

  async function lookup(token: unknown): Promise<{ invite: InviteRecord; hash: string }> {
    if (!isTokenShape(token)) throw new ConsentError('invalid_token');
    const hash = hashToken(token);
    const invite = await repo.findInviteByHash(hash);
    if (!invite) throw new ConsentError('invalid_token');
    return { invite, hash };
  }

  return {
    // ----------------------------------------------------------------- teen side (B7, B8)

    /** Teen enters the parent's WhatsApp number: invite + first WhatsApp message. */
    async askParent(studentId: string, input: { phone: unknown; hint?: unknown; locale: OtpLocale }): Promise<InviteView> {
      const phone = typeof input.phone === 'string' ? normalizePhone(input.phone) : null;
      if (!phone) throw new ConsentError('invalid_phone');
      const hint = typeof input.hint === 'string' && input.hint.trim() ? input.hint.trim().slice(0, 100) : null;
      const token = newToken();
      const invite = await repo.createInvite({ studentId, phone, hint, tokenHash: hashToken(token), expiresAt: expiryFrom(now(), INVITE_TTL_DAYS) });
      await repo.registerSend(invite.id, now(), maxResends);
      await sendInvite(invite, token, input.locale);
      return view((await repo.listInvites(studentId)).find((i) => i.id === invite.id) ?? invite);
    },

    /** Same invite, same number, fresh link (the old link stops working). At most 3 resends per rolling day. */
    async resend(studentId: string, inviteId: string, locale: OtpLocale): Promise<InviteView> {
      const invite = await ownLiveInvite(studentId, inviteId);
      await repo.registerSend(invite.id, now(), maxResends); // atomic limit check first
      const token = newToken();
      await repo.rotateInviteToken(invite.id, hashToken(token));
      await sendInvite(invite, token, locale);
      return view((await repo.listInvites(studentId)).find((i) => i.id === invite.id) ?? invite);
    },

    /** Wrong number: revoke the live invite, start over with the new number (counts toward the daily invite cap). */
    async changeNumber(studentId: string, inviteId: string, input: { phone: unknown; locale: OtpLocale }): Promise<InviteView> {
      const old = await ownLiveInvite(studentId, inviteId);
      return this.askParent(studentId, { phone: input.phone, hint: old.hint, locale: input.locale });
    },

    /** Teen screen: consent gate + latest invite. */
    async teenStatus(studentId: string): Promise<{ minor: boolean; consented: boolean; consent: ConsentRecord | null; invite: InviteView | null }> {
      const [gate, invites] = await Promise.all([repo.studentGate(studentId), repo.listInvites(studentId)]);
      const latest = invites[0];
      return { minor: gate.minor, consented: !gate.minor || gate.consent !== null, consent: gate.consent, invite: latest ? view(latest) : null };
    },

    // ----------------------------------------------------------------- guardian side (J1, J2)

    /** Side-effect free (safe for link previews). Same error for every bad token. */
    async peekInvite(token: string, locale: OtpLocale): Promise<PublicInvite> {
      const { invite } = await lookup(token);
      return { status: inviteStatus(invite, now()), teen: nickname(invite.studentName, locale), maskedPhone: maskPhone(invite.phone), expiresAt: invite.expiresAt };
    },

    /** The landing page calls this from the browser: pending -> opened. */
    async openInvite(token: string, locale: OtpLocale): Promise<PublicInvite> {
      const { invite, hash } = await lookup(token);
      if (isLive(inviteStatus(invite, now()))) await repo.markOpened(hash);
      return this.peekInvite(token, locale);
    },

    /** The invited number, only for the OTP step (server side; never sent to the browser). */
    async invitedPhone(token: string): Promise<string> {
      const { invite } = await lookup(token);
      if (!isLive(inviteStatus(invite, now()))) throw new ConsentError('invalid_token');
      return invite.phone;
    },

    async decline(token: string, locale: OtpLocale): Promise<PublicInvite> {
      const { invite, hash } = await lookup(token);
      if (!isLive(inviteStatus(invite, now()))) throw new ConsentError('conflict', 'invite is no longer active');
      await repo.decline(hash);
      return this.peekInvite(token, locale);
    },

    /** J2: the guardian (OTP-verified for the invited number) ticks the boxes. Creates consent + parent link. */
    async confirm(token: string, guardian: Guardian, form: GuardianForm, ctx: { locale: OtpLocale; userAgent?: string; ipHash?: string }): Promise<ConsentRecord> {
      const checks = validateChecks(form.checks);
      if (!isRelation(form.relation)) throw new ConsentError('invalid_input', 'relation', { field: 'relation' });
      const name = cleanName(form.name);
      const { invite, hash } = await lookup(token);
      if (!isLive(inviteStatus(invite, now()))) throw new ConsentError('invalid_token');
      if (invite.phone !== guardian.phone) throw new ConsentError('phone_mismatch');
      const consent = await repo.confirmInvite({
        tokenHash: hash,
        guardianUserId: guardian.userId,
        guardianPhone: guardian.phone,
        guardianName: name,
        relation: form.relation,
        policyVersion: POLICY_VERSION,
        evidence: evidence(checks, ctx),
      });
      await tell(grantedNotice({ phone: guardian.phone, locale: ctx.locale, teen: nickname(invite.studentName, ctx.locale), date: dateOnly(consent.grantedAt), link: familyLink(ctx.locale) }));
      return consent;
    },

    // ----------------------------------------------------------------- route B: family account (J3, J8)

    async addChild(
      parent: { userId: string; phone: string | null },
      input: { name: unknown; dob: unknown; school?: unknown; teenPhone: unknown; relation: unknown; guardianName: unknown; checks: unknown; locale: OtpLocale },
      ctx: { userAgent?: string; ipHash?: string } = {},
    ): Promise<{ studentId: string; consent: ConsentRecord }> {
      const checks = validateChecks(input.checks, [FAMILY_CHECK]);
      const name = cleanName(input.name);
      const guardianName = cleanName(input.guardianName, 'guardianName');
      if (!isRelation(input.relation)) throw new ConsentError('invalid_input', 'relation', { field: 'relation' });
      const dob = typeof input.dob === 'string' ? input.dob : '';
      const age = ageOn(dob, now());
      if (age === null || age < MIN_CHILD_AGE || age > MAX_CHILD_AGE) throw new ConsentError('invalid_input', 'dob', { field: 'dob' });
      const teenPhone = typeof input.teenPhone === 'string' ? normalizePhone(input.teenPhone) : null;
      if (!teenPhone) throw new ConsentError('invalid_phone');
      if (parent.phone && teenPhone === parent.phone) throw new ConsentError('invalid_input', 'teen number equals parent number', { field: 'teenPhone' });
      const school = typeof input.school === 'string' && input.school.trim() ? input.school.trim().slice(0, 200) : null;
      const created = await repo.addChild({
        parentId: parent.userId,
        parentPhone: parent.phone,
        name,
        dob,
        school,
        teenPhone,
        relation: input.relation,
        guardianName,
        locale: input.locale,
        policyVersion: POLICY_VERSION,
        evidence: evidence(checks, { locale: input.locale, ...ctx }),
      });
      // The teen claims the profile by signing in with this number (OTP proves they hold it).
      await tell(childClaimNotice({ phone: teenPhone, locale: input.locale, parent: guardianName, link: `${deps.origin.replace(/\/+$/, '')}/${input.locale}/login?next=/account` }));
      return created;
    },

    listChildren: (parentId: string): Promise<ChildRecord[]> => repo.listChildren(parentId),
    listGuardianConsents: (guardianId: string): Promise<ConsentRecord[]> => repo.listGuardianConsents(guardianId),

    /**
     * J8: withdraw. DB triggers pause the open full session and lock engagement features
     * (favorites, roadmaps, goals, XP) for a minor; the result says so for the UI.
     */
    async withdraw(actor: { userId: string; phone?: string | null; locale: OtpLocale }, consentId: string, reason: unknown): Promise<{ consent: ConsentRecord; effects: WithdrawEffects }> {
      const text = typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 500) : null;
      const consent = await repo.withdraw(actor.userId, consentId, text);
      const gate = await repo.studentGate(consent.studentId);
      const effects: WithdrawEffects = {
        assessmentPaused: gate.minor && gate.consent === null,
        featuresLocked: gate.minor && gate.consent === null,
        stillCovered: gate.consent !== null,
      };
      if (actor.phone) {
        await tell(withdrawnNotice({ phone: actor.phone, locale: actor.locale, teen: nickname(consent.studentName, actor.locale), date: dateOnly(consent.withdrawnAt ?? now().toISOString()) }));
      }
      return { consent, effects };
    },

    // ----------------------------------------------------------------- route C: school (B9)

    async joinClass(studentId: string, code: unknown) {
      const c = typeof code === 'string' ? code.trim().toUpperCase() : '';
      if (!/^[A-Z0-9]{6,12}$/.test(c)) throw new ConsentError('invalid_class_code');
      return repo.joinClass(studentId, c);
    },
    schoolView: (userId: string): Promise<SchoolView | null> => repo.schoolView(userId),
    async createJoinCode(userId: string, organizationId: string, cohort: unknown) {
      const label = typeof cohort === 'string' && cohort.trim() ? cohort.trim().slice(0, 100) : null;
      return repo.createJoinCode(userId, organizationId, label);
    },
    async recordSchoolConsent(
      actorId: string,
      input: { organizationId: string; studentId: string; method: unknown; representativeName: unknown; confirmed: unknown; locale: OtpLocale },
    ): Promise<ConsentRecord> {
      if (input.confirmed !== true) throw new ConsentError('checks_required');
      const method = input.method === 'paper_form' ? 'paper_form' : input.method === 'school_attestation' ? 'school_attestation' : null;
      if (!method) throw new ConsentError('invalid_input', 'method', { field: 'method' });
      return repo.recordSchoolConsent({
        actorId,
        organizationId: input.organizationId,
        studentId: input.studentId,
        method,
        representativeName: cleanName(input.representativeName, 'representativeName'),
        policyVersion: POLICY_VERSION,
        // School route: the school attests that it holds the guardians' written consent (Part 2 slip).
        evidence: { checks: ['school_attests_guardian_consent'], textVersion: CONSENT_TEXT_VERSION, locale: input.locale },
      });
    },

    // ----------------------------------------------------------------- gate
    async gateState(studentId: string): Promise<{ minor: boolean; locked: boolean }> {
      const g = await repo.studentGate(studentId);
      return { minor: g.minor, locked: g.minor && g.consent === null };
    },
  };
}

export interface WithdrawEffects {
  /** The open full assessment session was paused by the DB trigger. */
  assessmentPaused: boolean;
  /** Favorites, roadmaps, goals and XP are locked again for this minor. */
  featuresLocked: boolean;
  /** Another active consent still covers the student. */
  stillCovered: boolean;
}

export type ConsentService = ReturnType<typeof createConsentService>;

function evidence(checks: string[], ctx: { locale: 'ar' | 'en'; userAgent?: string; ipHash?: string }): Evidence {
  return {
    checks,
    textVersion: CONSENT_TEXT_VERSION,
    locale: ctx.locale,
    ...(ctx.ipHash ? { ipHash: ctx.ipHash } : {}),
    ...(ctx.userAgent ? { userAgent: ctx.userAgent.slice(0, 300) } : {}),
  };
}

/** YYYY-MM-DD in Africa/Cairo (the legal draft asks for UTC and Cairo time; the record itself keeps UTC). */
function dateOnly(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
