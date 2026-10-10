import type { Relation } from './constants';
import type { InviteStatus } from './state';

export type ConsentErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_json'
  | 'invalid_input'
  | 'invalid_phone'
  | 'invalid_token'
  | 'invalid_code'
  | 'invalid_class_code'
  | 'checks_required'
  | 'phone_mismatch'
  | 'resend_limit'
  | 'invite_limit'
  | 'not_found'
  | 'send_failed'
  | 'rate_limited'
  | 'conflict'
  | 'server_error';

export const ERROR_STATUS: Record<ConsentErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  invalid_json: 400,
  invalid_input: 400,
  invalid_phone: 400,
  invalid_token: 404,
  invalid_code: 400,
  invalid_class_code: 404,
  checks_required: 400,
  phone_mismatch: 403,
  resend_limit: 429,
  invite_limit: 429,
  not_found: 404,
  send_failed: 502,
  rate_limited: 429,
  conflict: 409,
  server_error: 500,
};

export class ConsentError extends Error {
  constructor(
    public readonly code: ConsentErrorCode,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? code);
    this.name = 'ConsentError';
  }
}

export type ConsentRoute = 'teen_invite' | 'parent_account' | 'school';
export type ConsentMethod = 'whatsapp_link' | 'email_link' | 'in_app' | 'school_attestation' | 'paper_form';

export interface InviteRecord {
  id: string;
  studentId: string;
  /** Display name of the teen (shown to the guardian as the nickname: first name only). */
  studentName: string;
  /** E.164. Never shown in full to anyone but the teen who typed it. */
  phone: string;
  hint: string | null;
  createdAt: string;
  expiresAt: string;
  openedAt: string | null;
  usedAt: string | null;
  declinedAt: string | null;
  revokedAt: string | null;
  /** Timestamps of every WhatsApp send (first send + resends). */
  sends: string[];
}

export interface ConsentRecord {
  id: string;
  studentId: string;
  studentName: string;
  route: ConsentRoute;
  method: ConsentMethod;
  guardianName: string;
  guardianRelation: Relation | 'school';
  guardianUserId: string | null;
  organizationId: string | null;
  inviteId: string | null;
  policyVersion: string;
  scope: string[];
  grantedAt: string;
  withdrawnAt: string | null;
  withdrawnReason: string | null;
}

export interface Evidence {
  /** Ticked boxes, ids from CONSENT_CHECKS (+ 'family'). */
  checks: string[];
  textVersion: string;
  locale: 'ar' | 'en';
  /** Hash only; the raw IP is stored only if counsel approves (open question in the legal draft). */
  ipHash?: string;
  userAgent?: string;
}

export interface ChildRecord {
  studentId: string;
  name: string;
  dob: string | null;
  school: string | null;
  /** The teen has signed in with the invited number and taken over the profile. */
  claimed: boolean;
  consent: ConsentRecord | null;
}

export interface SchoolStudent {
  studentId: string;
  name: string;
  cohort: string | null;
  consent: ConsentRecord | null;
}

export interface SchoolView {
  organizationId: string;
  organizationName: string;
  students: SchoolStudent[];
  joinCodes: { code: string; cohort: string | null; expiresAt: string | null }[];
}

export interface ConfirmInviteInput {
  tokenHash: string;
  guardianUserId: string;
  guardianPhone: string;
  guardianName: string;
  relation: Relation;
  policyVersion: string;
  evidence: Evidence;
}

export interface AddChildInput {
  parentId: string;
  parentPhone: string | null;
  name: string;
  dob: string;
  school: string | null;
  /** Needed so the teen can claim the profile by signing in with this number. */
  teenPhone: string;
  relation: Relation;
  guardianName: string;
  locale: 'ar' | 'en';
  policyVersion: string;
  evidence: Evidence;
}

export interface SchoolConsentInput {
  actorId: string;
  organizationId: string;
  studentId: string;
  method: 'school_attestation' | 'paper_form';
  representativeName: string;
  policyVersion: string;
  evidence: Evidence;
}

/** Storage port. Implemented by MemoryConsentRepo (mock mode, tests) and SupabaseConsentRepo. */
export interface ConsentRepo {
  /** Revokes the student's still-live invites, then creates the new one (at most one live invite per student). */
  createInvite(input: { studentId: string; phone: string; hint: string | null; tokenHash: string; expiresAt: Date }): Promise<InviteRecord>;
  /** Atomic: throws ConsentError('resend_limit') when the rolling-24h budget is used up, or 'not_found' if the invite is not live. */
  registerSend(inviteId: string, now: Date, maxResends: number): Promise<void>;
  /** Replace the stored hash of a LIVE invite (the raw token is never stored, so a resend must issue a fresh link). */
  rotateInviteToken(inviteId: string, tokenHash: string): Promise<void>;
  findInviteByHash(tokenHash: string): Promise<InviteRecord | null>;
  listInvites(studentId: string): Promise<InviteRecord[]>;
  markOpened(tokenHash: string): Promise<boolean>;
  decline(tokenHash: string): Promise<boolean>;
  /** Creates the teen_invite consent + active parent link and marks the invite used, atomically. */
  confirmInvite(input: ConfirmInviteInput): Promise<ConsentRecord>;

  addChild(input: AddChildInput): Promise<{ studentId: string; consent: ConsentRecord }>;
  listChildren(parentId: string): Promise<ChildRecord[]>;
  listGuardianConsents(guardianId: string): Promise<ConsentRecord[]>;
  getConsent(consentId: string): Promise<ConsentRecord | null>;
  /** Only the granting guardian, the student, or an org admin (school route) may withdraw; idempotent. */
  withdraw(actorId: string, consentId: string, reason: string | null): Promise<ConsentRecord>;

  /** Active (un-withdrawn, unexpired) consent covering 'assessment', or null. Also tells whether the student is a minor. */
  studentGate(studentId: string): Promise<{ minor: boolean; consent: ConsentRecord | null }>;
  studentProfile(studentId: string): Promise<{ name: string; locale: 'ar' | 'en' } | null>;

  joinClass(studentId: string, code: string): Promise<{ organizationId: string; organizationName: string; cohort: string | null }>;
  schoolView(userId: string): Promise<SchoolView | null>;
  createJoinCode(userId: string, organizationId: string, cohort: string | null): Promise<{ code: string }>;
  recordSchoolConsent(input: SchoolConsentInput): Promise<ConsentRecord>;
}

/** What a client may see of an invite. No token, no full phone number. */
export interface InviteView {
  id: string;
  status: InviteStatus;
  maskedPhone: string;
  hint: string | null;
  createdAt: string;
  expiresAt: string;
  sentAt: string | null;
  openedAt: string | null;
  resendsLeft: number;
  /** When the next resend becomes possible (only when resendsLeft is 0). */
  retryAt: string | null;
}
