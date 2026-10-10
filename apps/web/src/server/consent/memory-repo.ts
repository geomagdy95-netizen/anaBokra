import { MAX_INVITES_PER_DAY } from './constants';
import { inviteStatus, isLive, sendBudget } from './state';
import {
  ConsentError,
  type AddChildInput,
  type ChildRecord,
  type ConfirmInviteInput,
  type ConsentRecord,
  type ConsentRepo,
  type InviteRecord,
  type SchoolConsentInput,
  type SchoolView,
} from './types';

interface Person {
  id: string;
  role: 'student' | 'parent' | 'school_admin';
  name: string;
  dob: string | null;
  school: string | null;
  phone: string | null;
  locale: 'ar' | 'en';
  claimed: boolean;
}
interface Org {
  id: string;
  name: string;
  staff: Set<string>;
  members: Map<string, { cohort: string | null }>;
  codes: { code: string; cohort: string | null; expiresAt: string | null; revoked: boolean }[];
}
interface Link {
  parentId: string;
  studentId: string;
  active: boolean;
}

const DAY = 86_400_000;

export interface MemoryConsentOptions {
  now?: () => Date;
  /** Called whenever a student's "has an active consent" flips (mock mode wires this to the assessment gate). */
  onActiveChange?: (studentId: string, active: boolean) => void;
}

/**
 * In-memory ConsentRepo: mock mode (ASSESSMENT_REPO=memory) and unit tests. It mirrors the DB rules
 * (one live invite per student, atomic send budget, append-only consents, final withdrawal,
 * the invited number must match) so tests exercise the same state machine as the SQL functions.
 */
export class MemoryConsentRepo implements ConsentRepo {
  readonly people = new Map<string, Person>();
  readonly invites: InviteRecord[] = [];
  readonly consents: ConsentRecord[] = [];
  readonly links: Link[] = [];
  readonly orgs = new Map<string, Org>();
  private seq = 0;
  private readonly now: () => Date;

  constructor(private readonly opts: MemoryConsentOptions = {}) {
    this.now = opts.now ?? (() => new Date());
  }

  private id(prefix = 'c0'): string {
    this.seq += 1;
    return `${prefix}000000-0000-4000-8000-${String(this.seq).padStart(12, '0')}`;
  }

  // ------------------------------------------------------------- fixtures (tests, mock mode)
  addPerson(p: Partial<Person> & Pick<Person, 'id' | 'role'>): Person {
    const full: Person = { name: '', dob: null, school: null, phone: null, locale: 'ar', claimed: true, ...p };
    this.people.set(full.id, full);
    return full;
  }
  addOrg(o: { id: string; name: string; staff: string[]; code?: string; cohort?: string }): void {
    this.orgs.set(o.id, {
      id: o.id,
      name: o.name,
      staff: new Set(o.staff),
      members: new Map(),
      codes: o.code ? [{ code: o.code, cohort: o.cohort ?? null, expiresAt: null, revoked: false }] : [],
    });
  }

  /** Test/mock fixture: an already-recorded consent without going through a flow. */
  grantFixture(studentId: string, route: 'parent_account' | 'teen_invite' = 'parent_account', guardianUserId: string | null = null): ConsentRecord {
    return this.writeConsent({
      studentId,
      route,
      method: route === 'parent_account' ? 'in_app' : 'whatsapp_link',
      guardianName: 'Fixture',
      guardianRelation: 'mother',
      guardianUserId,
      organizationId: null,
      inviteId: null,
      policyVersion: 'fixture',
    });
  }

  private notifyActive(studentId: string) {
    this.opts.onActiveChange?.(studentId, this.activeConsent(studentId) !== null);
  }
  private person(id: string): Person {
    const p = this.people.get(id);
    if (!p) throw new ConsentError('not_found');
    return p;
  }
  private activeConsent(studentId: string): ConsentRecord | null {
    const t = this.now().getTime();
    return (
      this.consents.find(
        (c) => c.studentId === studentId && c.withdrawnAt === null && new Date(c.grantedAt).getTime() <= t && c.scope.includes('assessment'),
      ) ?? null
    );
  }
  private isMinor(studentId: string): boolean {
    const dob = this.people.get(studentId)?.dob;
    if (!dob) return true; // unknown DOB is treated as a minor (same as the DB)
    const cutoff = new Date(this.now());
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 18);
    return new Date(dob).getTime() > cutoff.getTime();
  }
  private writeConsent(c: Omit<ConsentRecord, 'id' | 'grantedAt' | 'withdrawnAt' | 'withdrawnReason' | 'studentName' | 'scope'> & { scope?: string[] }): ConsentRecord {
    const rec: ConsentRecord = {
      ...c,
      id: this.id('c0'),
      studentName: this.person(c.studentId).name,
      scope: c.scope ?? ['assessment', 'data_processing'],
      grantedAt: this.now().toISOString(),
      withdrawnAt: null,
      withdrawnReason: null,
    };
    this.consents.push(rec);
    this.notifyActive(c.studentId);
    return rec;
  }

  // ------------------------------------------------------------- invites
  async createInvite(i: { studentId: string; phone: string; hint: string | null; tokenHash: string; expiresAt: Date }): Promise<InviteRecord> {
    const s = this.person(i.studentId);
    if (s.role !== 'student') throw new ConsentError('forbidden');
    const t = this.now();
    for (const o of this.invites) {
      if (o.studentId === i.studentId && isLive(inviteStatus(o, t))) o.revokedAt = t.toISOString();
    }
    if (this.invites.filter((o) => o.studentId === i.studentId && t.getTime() - new Date(o.createdAt).getTime() < DAY).length >= MAX_INVITES_PER_DAY) {
      throw new ConsentError('invite_limit');
    }
    const rec: InviteRecord & { tokenHash: string } = {
      id: this.id('1a'),
      studentId: i.studentId,
      studentName: s.name,
      phone: i.phone,
      hint: i.hint,
      createdAt: t.toISOString(),
      expiresAt: i.expiresAt.toISOString(),
      openedAt: null,
      usedAt: null,
      declinedAt: null,
      revokedAt: null,
      sends: [],
      tokenHash: i.tokenHash,
    };
    this.invites.push(rec);
    return structuredClone(rec);
  }
  private byId(id: string) {
    return this.invites.find((i) => i.id === id);
  }
  private byHash(hash: string) {
    return this.invites.find((i) => (i as InviteRecord & { tokenHash: string }).tokenHash === hash);
  }
  async registerSend(inviteId: string, now: Date, maxResends: number): Promise<void> {
    const inv = this.byId(inviteId);
    if (!inv || !isLive(inviteStatus(inv, now))) throw new ConsentError('not_found');
    if (!sendBudget(inv.sends, now, maxResends).canSend) throw new ConsentError('resend_limit');
    inv.sends.push(now.toISOString());
  }
  async rotateInviteToken(inviteId: string, tokenHash: string): Promise<void> {
    const inv = this.byId(inviteId);
    if (!inv || !isLive(inviteStatus(inv, this.now()))) throw new ConsentError('not_found');
    (inv as InviteRecord & { tokenHash: string }).tokenHash = tokenHash;
  }
  async findInviteByHash(hash: string) {
    const i = this.byHash(hash);
    if (!i) return null;
    const { ...rec } = i as InviteRecord & { tokenHash?: string };
    delete rec.tokenHash;
    return structuredClone(rec);
  }
  async listInvites(studentId: string) {
    return this.invites
      .filter((i) => i.studentId === studentId)
      .map((i) => {
        const { ...rec } = i as InviteRecord & { tokenHash?: string };
        delete rec.tokenHash;
        return structuredClone(rec);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || (a.id < b.id ? 1 : -1));
  }
  async markOpened(hash: string) {
    const i = this.byHash(hash);
    if (!i || !isLive(inviteStatus(i, this.now()))) return false;
    i.openedAt ??= this.now().toISOString();
    return true;
  }
  async decline(hash: string) {
    const i = this.byHash(hash);
    if (!i || !isLive(inviteStatus(i, this.now()))) return false;
    i.declinedAt = this.now().toISOString();
    i.openedAt ??= i.declinedAt;
    return true;
  }
  async confirmInvite(c: ConfirmInviteInput): Promise<ConsentRecord> {
    const i = this.byHash(c.tokenHash);
    if (!i || !isLive(inviteStatus(i, this.now()))) throw new ConsentError('invalid_token');
    if (i.phone !== c.guardianPhone) throw new ConsentError('phone_mismatch');
    const rec = this.writeConsent({
      studentId: i.studentId,
      route: 'teen_invite',
      method: 'whatsapp_link',
      guardianName: c.guardianName,
      guardianRelation: c.relation,
      guardianUserId: c.guardianUserId,
      organizationId: null,
      inviteId: i.id,
      policyVersion: c.policyVersion,
    });
    i.usedAt = this.now().toISOString();
    i.openedAt ??= i.usedAt;
    this.link(c.guardianUserId, i.studentId);
    return rec;
  }
  private link(parentId: string, studentId: string) {
    const l = this.links.find((x) => x.parentId === parentId && x.studentId === studentId);
    if (l) l.active = true;
    else this.links.push({ parentId, studentId, active: true });
  }

  // ------------------------------------------------------------- route B
  async addChild(a: AddChildInput) {
    const parent = this.person(a.parentId);
    if (parent.role !== 'parent') throw new ConsentError('forbidden');
    if (this.links.filter((l) => l.parentId === a.parentId && l.active).length >= 10) throw new ConsentError('invite_limit');
    if ([...this.people.values()].some((p) => p.phone === a.teenPhone)) throw new ConsentError('conflict', 'teen number already has an account');
    const id = this.id('5d');
    this.addPerson({ id, role: 'student', name: a.name, dob: a.dob, school: a.school, phone: a.teenPhone, locale: a.locale, claimed: false });
    this.link(a.parentId, id);
    const consent = this.writeConsent({
      studentId: id,
      route: 'parent_account',
      method: 'in_app',
      guardianName: a.guardianName,
      guardianRelation: a.relation,
      guardianUserId: a.parentId,
      organizationId: null,
      inviteId: null,
      policyVersion: a.policyVersion,
    });
    return { studentId: id, consent };
  }
  async listChildren(parentId: string): Promise<ChildRecord[]> {
    return this.links
      .filter((l) => l.parentId === parentId && l.active)
      .map((l) => {
        const p = this.person(l.studentId);
        return { studentId: p.id, name: p.name, dob: p.dob, school: p.school, claimed: p.claimed, consent: this.activeConsent(p.id) };
      });
  }
  async listGuardianConsents(guardianId: string) {
    return this.consents.filter((c) => c.guardianUserId === guardianId).map((c) => structuredClone(c)).reverse();
  }
  async getConsent(id: string) {
    const c = this.consents.find((x) => x.id === id);
    return c ? structuredClone(c) : null;
  }
  async withdraw(actorId: string, consentId: string, reason: string | null) {
    const c = this.consents.find((x) => x.id === consentId);
    if (!c) throw new ConsentError('not_found');
    const orgAdmin = c.organizationId ? this.orgs.get(c.organizationId)?.staff.has(actorId) : false;
    if (!(actorId === c.studentId || actorId === c.guardianUserId || orgAdmin)) throw new ConsentError('forbidden');
    if (c.withdrawnAt === null) {
      c.withdrawnAt = this.now().toISOString();
      c.withdrawnReason = reason;
      this.notifyActive(c.studentId);
    }
    return structuredClone(c);
  }

  // ------------------------------------------------------------- gate
  async studentGate(studentId: string) {
    const c = this.activeConsent(studentId);
    return { minor: this.isMinor(studentId), consent: c ? structuredClone(c) : null };
  }
  async studentProfile(studentId: string) {
    const p = this.people.get(studentId);
    return p ? { name: p.name, locale: p.locale } : null;
  }

  // ------------------------------------------------------------- route C
  async joinClass(studentId: string, code: string) {
    const s = this.person(studentId);
    if (s.role !== 'student') throw new ConsentError('forbidden');
    const t = this.now().getTime();
    for (const org of this.orgs.values()) {
      const hit = org.codes.find((c) => c.code === code && !c.revoked && (!c.expiresAt || new Date(c.expiresAt).getTime() > t));
      if (hit) {
        if (!org.members.has(studentId)) org.members.set(studentId, { cohort: hit.cohort });
        return { organizationId: org.id, organizationName: org.name, cohort: hit.cohort };
      }
    }
    throw new ConsentError('invalid_class_code');
  }
  private staffOrg(userId: string): Org | null {
    return [...this.orgs.values()].find((o) => o.staff.has(userId)) ?? null;
  }
  async schoolView(userId: string): Promise<SchoolView | null> {
    const org = this.staffOrg(userId);
    if (!org) return null;
    return {
      organizationId: org.id,
      organizationName: org.name,
      students: [...org.members].map(([sid, m]) => ({
        studentId: sid,
        name: this.person(sid).name,
        cohort: m.cohort,
        consent: this.consents.find((c) => c.studentId === sid && c.organizationId === org.id && c.withdrawnAt === null) ?? null,
      })),
      joinCodes: org.codes.filter((c) => !c.revoked).map((c) => ({ code: c.code, cohort: c.cohort, expiresAt: c.expiresAt })),
    };
  }
  async createJoinCode(userId: string, organizationId: string, cohort: string | null) {
    const org = this.orgs.get(organizationId);
    if (!org || !org.staff.has(userId)) throw new ConsentError('forbidden');
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    org.codes.push({ code, cohort, expiresAt: null, revoked: false });
    return { code };
  }
  async recordSchoolConsent(i: SchoolConsentInput) {
    const org = this.orgs.get(i.organizationId);
    if (!org || !org.staff.has(i.actorId)) throw new ConsentError('forbidden');
    if (!org.members.has(i.studentId)) throw new ConsentError('forbidden', 'student has not joined this school');
    return this.writeConsent({
      studentId: i.studentId,
      route: 'school',
      method: i.method,
      guardianName: i.representativeName,
      guardianRelation: 'school',
      guardianUserId: null,
      organizationId: i.organizationId,
      inviteId: null,
      policyVersion: i.policyVersion,
    });
  }
}
