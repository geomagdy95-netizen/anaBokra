import { randomInt } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { MAX_RESENDS_PER_DAY } from './constants';
import {
  ConsentError,
  type AddChildInput,
  type ChildRecord,
  type ConfirmInviteInput,
  type ConsentRecord,
  type ConsentRepo,
  type ConsentRoute,
  type InviteRecord,
  type SchoolConsentInput,
  type SchoolView,
} from './types';

type Row = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** Postgres error -> ConsentError. The functions raise named exceptions (see migration 11). */
function fail(error: { code?: string; message?: string }): never {
  const msg = error.message ?? '';
  if (/phone_mismatch/.test(msg)) throw new ConsentError('phone_mismatch');
  if (/invalid_or_expired_invite|invite_not_active/.test(msg)) throw new ConsentError('invalid_token');
  if (/invalid_class_code/.test(msg)) throw new ConsentError('invalid_class_code');
  if (/resend_limit/.test(msg)) throw new ConsentError('resend_limit');
  if (error.code === '54000') throw new ConsentError('invite_limit', msg);
  if (error.code === '42501') throw new ConsentError('forbidden', msg);
  if (error.code === '23505') throw new ConsentError('conflict', msg);
  if (error.code === '22023' || error.code === '23514') throw new ConsentError('invalid_input', msg);
  throw new Error(`consent repo: ${error.code ?? '-'} ${msg}`);
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const classCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

/**
 * Supabase-backed ConsentRepo. `admin` (service role) runs the backend-only SQL functions of migration 11;
 * `user` (the signed-in user's client) is used where RLS / auth.uid() must decide (withdrawal, school writes).
 */
export class SupabaseConsentRepo implements ConsentRepo {
  constructor(
    private readonly user: SupabaseClient,
    private readonly admin: SupabaseClient,
  ) {}

  private async names(ids: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (ids.length === 0) return out;
    const { data, error } = await this.admin.from('profiles').select('id, display_name').in('id', [...new Set(ids)]);
    if (error) fail(error);
    for (const r of (data ?? []) as Row[]) out.set(r.id as string, (str(r.display_name) ?? '').trim());
    return out;
  }

  private consentOf(r: Row, names: Map<string, string>): ConsentRecord {
    return {
      id: r.id as string,
      studentId: r.student_id as string,
      studentName: names.get(r.student_id as string) ?? '',
      route: r.route as ConsentRoute,
      method: r.method as ConsentRecord['method'],
      guardianName: r.guardian_name as string,
      guardianRelation: r.guardian_relation as ConsentRecord['guardianRelation'],
      guardianUserId: str(r.guardian_user_id),
      organizationId: str(r.organization_id),
      inviteId: str(r.invite_id),
      policyVersion: r.policy_version as string,
      scope: (r.scope as string[]) ?? [],
      grantedAt: r.granted_at as string,
      withdrawnAt: str(r.withdrawn_at),
      withdrawnReason: str(r.withdrawn_reason),
    };
  }

  private async consentsWhere(build: (q: ReturnType<SupabaseClient['from']>) => unknown, client: SupabaseClient = this.admin): Promise<ConsentRecord[]> {
    const q = client.from('consents').select('*');
    const { data, error } = (await build(q as never)) as { data: Row[] | null; error: { code?: string; message?: string } | null };
    if (error) fail(error);
    const rows = data ?? [];
    const names = await this.names(rows.map((r) => r.student_id as string));
    return rows.map((r) => this.consentOf(r, names));
  }

  // ------------------------------------------------------------- invites
  private inviteOf(r: Row, name: string): InviteRecord {
    return {
      id: (r.invite_id ?? r.id) as string,
      studentId: r.student_id as string,
      studentName: name,
      phone: (str(r.whatsapp_number) ?? '') as string,
      hint: str(r.guardian_hint),
      createdAt: r.created_at as string,
      expiresAt: r.expires_at as string,
      openedAt: str(r.opened_at),
      usedAt: str(r.used_at),
      declinedAt: str(r.declined_at),
      revokedAt: str(r.revoked_at),
      sends: ((r.sends as string[] | null) ?? []).map(String),
    };
  }

  async createInvite(i: { studentId: string; phone: string; hint: string | null; tokenHash: string; expiresAt: Date }) {
    const ttlMs = Math.max(60_000, i.expiresAt.getTime() - Date.now());
    const { data, error } = await this.admin.rpc('consent_invite_create', {
      p_student: i.studentId,
      p_whatsapp: i.phone,
      p_hint: i.hint,
      p_hash_hex: i.tokenHash,
      p_ttl: `${Math.round(ttlMs / 1000)} seconds`,
    });
    if (error) fail(error);
    const created = (data as Row[])[0]!;
    const found = await this.findInviteByHash(i.tokenHash);
    if (!found) throw new Error(`invite ${String(created.invite_id)} vanished`);
    return found;
  }

  async registerSend(inviteId: string, _now: Date, maxResends: number) {
    void _now;
    const { error } = await this.admin.rpc('consent_invite_register_send', { p_invite: inviteId, p_max_resends: maxResends ?? MAX_RESENDS_PER_DAY });
    if (error) {
      if (/invite_not_active/.test(error.message)) throw new ConsentError('not_found');
      fail(error);
    }
  }

  async rotateInviteToken(inviteId: string, tokenHash: string) {
    const { data, error } = await this.admin.rpc('consent_invite_rotate', { p_invite: inviteId, p_hash_hex: tokenHash });
    if (error) fail(error);
    if (data !== true) throw new ConsentError('not_found');
  }

  async findInviteByHash(tokenHash: string) {
    const { data, error } = await this.admin.rpc('consent_invite_lookup', { p_hash_hex: tokenHash });
    if (error) fail(error);
    const r = (data as Row[] | null)?.[0];
    return r ? this.inviteOf(r, str(r.student_name) ?? '') : null;
  }

  async listInvites(studentId: string) {
    const { data, error } = await this.admin
      .from('consent_invites')
      .select('id, student_id, whatsapp_number, guardian_hint, created_at, expires_at, opened_at, used_at, declined_at, revoked_at, sends')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) fail(error);
    const name = (await this.names([studentId])).get(studentId) ?? '';
    return ((data ?? []) as Row[]).map((r) => this.inviteOf(r, name));
  }

  async markOpened(tokenHash: string) {
    const { data, error } = await this.admin.rpc('consent_invite_mark_opened', { p_hash_hex: tokenHash });
    if (error) fail(error);
    return data === true;
  }

  async decline(tokenHash: string) {
    const { data, error } = await this.admin.rpc('consent_invite_decline', { p_hash_hex: tokenHash });
    if (error) fail(error);
    return data === true;
  }

  async confirmInvite(c: ConfirmInviteInput) {
    const { data, error } = await this.admin.rpc('consent_invite_confirm', {
      p_hash_hex: c.tokenHash,
      p_guardian: c.guardianUserId,
      p_guardian_phone: c.guardianPhone,
      p_name: c.guardianName,
      p_relation: c.relation,
      p_policy_version: c.policyVersion,
      p_evidence: c.evidence,
    });
    if (error) fail(error);
    const rec = await this.getConsent(data as string);
    if (!rec) throw new Error('consent vanished after confirm');
    return rec;
  }

  // ------------------------------------------------------------- route B
  async addChild(a: AddChildInput) {
    const { data: created, error: createError } = await this.admin.auth.admin.createUser({
      phone: a.teenPhone,
      phone_confirm: true,
      user_metadata: { role: 'student', locale: a.locale, display_name: a.name, created_by_parent: a.parentId },
    });
    if (createError || !created.user) {
      if (createError && /already|registered|exists/i.test(createError.message)) throw new ConsentError('conflict', 'teen number already has an account');
      throw new Error(`createUser failed: ${createError?.message ?? 'no user'}`);
    }
    const childId = created.user.id;
    const { data, error } = await this.admin.rpc('family_add_child', {
      p_parent: a.parentId,
      p_child: childId,
      p_display_name: a.name,
      p_dob: a.dob,
      p_school: a.school,
      p_relation: a.relation,
      p_guardian_name: a.guardianName,
      p_policy_version: a.policyVersion,
      p_evidence: a.evidence,
    });
    if (error) {
      await this.admin.auth.admin.deleteUser(childId).catch(() => undefined); // do not leave an orphan account
      fail(error);
    }
    await this.admin.from('profiles').update({ phone: a.teenPhone }).eq('id', childId);
    const consent = await this.getConsent(data as string);
    if (!consent) throw new Error('consent vanished after family_add_child');
    return { studentId: childId, consent };
  }

  async listChildren(parentId: string): Promise<ChildRecord[]> {
    const { data: links, error } = await this.admin.from('parent_links').select('student_id').eq('parent_id', parentId).eq('status', 'active');
    if (error) fail(error);
    const ids = ((links ?? []) as Row[]).map((l) => l.student_id as string);
    if (ids.length === 0) return [];
    const { data: profiles, error: pe } = await this.admin.from('profiles').select('id, display_name, date_of_birth, school_name, last_seen_at').in('id', ids);
    if (pe) fail(pe);
    const consents = await this.consentsWhere((q) => (q as never as { in: (c: string, v: string[]) => { is: (c: string, v: null) => unknown } }).in('student_id', ids).is('withdrawn_at', null));
    return ((profiles ?? []) as Row[]).map((p) => ({
      studentId: p.id as string,
      name: (str(p.display_name) ?? '').trim(),
      dob: str(p.date_of_birth),
      school: str(p.school_name),
      claimed: p.last_seen_at != null,
      consent: consents.find((c) => c.studentId === p.id) ?? null,
    }));
  }

  async listGuardianConsents(guardianId: string) {
    return (await this.consentsWhere((q) => (q as never as { eq: (c: string, v: string) => { order: (c: string, o: object) => unknown } }).eq('guardian_user_id', guardianId).order('granted_at', { ascending: false }))).slice(0, 50);
  }

  async getConsent(consentId: string) {
    const rows = await this.consentsWhere((q) => (q as never as { eq: (c: string, v: string) => unknown }).eq('id', consentId));
    return rows[0] ?? null;
  }

  async withdraw(_actorId: string, consentId: string, reason: string | null) {
    void _actorId; // the DB checks auth.uid() of the signed-in client
    const { error } = await this.user.rpc('withdraw_consent', { p_consent: consentId, p_reason: reason });
    if (error) {
      if (error.code === 'P0002') throw new ConsentError('not_found');
      fail(error);
    }
    const rec = await this.getConsent(consentId);
    if (!rec) throw new ConsentError('not_found');
    return rec;
  }

  // ------------------------------------------------------------- gate
  async studentGate(studentId: string) {
    const [{ data: minor, error: me }, active] = await Promise.all([
      this.admin.rpc('is_minor', { p_user: studentId }),
      this.consentsWhere((q) =>
        (q as never as { eq: (c: string, v: string) => { is: (c: string, v: null) => { contains: (c: string, v: string[]) => { order: (c: string, o: object) => { limit: (n: number) => unknown } } } } })
          .eq('student_id', studentId)
          .is('withdrawn_at', null)
          .contains('scope', ['assessment'])
          .order('granted_at', { ascending: false })
          .limit(5),
      ),
    ]);
    if (me) fail(me);
    const nowMs = Date.now();
    const rows = await this.consentExpiryFilter(studentId, active, nowMs);
    return { minor: minor !== false, consent: rows[0] ?? null };
  }
  /** consents.expires_at is not part of ConsentRecord; filter expired ones with a tiny extra query. */
  private async consentExpiryFilter(studentId: string, active: ConsentRecord[], nowMs: number) {
    if (active.length === 0) return active;
    const { data } = await this.admin.from('consents').select('id, expires_at, granted_at').eq('student_id', studentId).in('id', active.map((c) => c.id));
    const ok = new Set(
      ((data ?? []) as Row[])
        .filter((r) => (r.expires_at == null || new Date(r.expires_at as string).getTime() > nowMs) && new Date(r.granted_at as string).getTime() <= nowMs)
        .map((r) => r.id as string),
    );
    return active.filter((c) => ok.has(c.id));
  }

  async studentProfile(studentId: string) {
    const { data, error } = await this.admin.from('profiles').select('display_name, locale').eq('id', studentId).maybeSingle();
    if (error) fail(error);
    if (!data) return null;
    return { name: (str((data as Row).display_name) ?? '').trim(), locale: ((data as Row).locale === 'en' ? 'en' : 'ar') as 'ar' | 'en' };
  }

  // ------------------------------------------------------------- route C
  async joinClass(studentId: string, code: string) {
    const { data, error } = await this.admin.rpc('org_join_by_code', { p_student: studentId, p_code: code });
    if (error) fail(error);
    const row = (data as Row[])[0]!;
    const { data: org } = await this.admin.from('organizations').select('name').eq('id', row.joined_org as string).maybeSingle();
    const n = ((org as Row | null)?.name ?? {}) as { en?: string; ar?: string };
    return { organizationId: row.joined_org as string, organizationName: n.en ?? n.ar ?? '', cohort: str(row.joined_cohort) };
  }

  async schoolView(userId: string): Promise<SchoolView | null> {
    // RLS decides: a member can read their own org_members rows and their organization.
    const { data: mine, error } = await this.user
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', userId)
      .eq('status', 'active')
      .in('role', ['owner', 'admin', 'counselor', 'teacher']);
    if (error) fail(error);
    const m = ((mine ?? []) as Row[])[0];
    if (!m) return null;
    const orgId = m.org_id as string;
    const { data: org } = await this.user.from('organizations').select('id, name, status').eq('id', orgId).maybeSingle();
    if (!org || (org as Row).status !== 'active') return null;
    const orgName = ((org as Row).name ?? {}) as { en?: string; ar?: string };

    const { data: members, error: me } = await this.admin
      .from('org_members')
      .select('user_id, cohort')
      .eq('org_id', orgId)
      .eq('role', 'student')
      .eq('status', 'active')
      .limit(500);
    if (me) fail(me);
    const ids = ((members ?? []) as Row[]).map((r) => r.user_id as string);
    const [names, consents, codes] = await Promise.all([
      this.names(ids),
      ids.length
        ? this.consentsWhere((q) => (q as never as { eq: (c: string, v: string) => { is: (c: string, v: null) => unknown } }).eq('organization_id', orgId).is('withdrawn_at', null))
        : Promise.resolve([] as ConsentRecord[]),
      this.user.from('org_join_codes').select('code, cohort, expires_at').eq('org_id', orgId).is('revoked_at', null),
    ]);
    return {
      organizationId: orgId,
      organizationName: orgName.en ?? orgName.ar ?? '',
      students: ((members ?? []) as Row[]).map((r) => ({
        studentId: r.user_id as string,
        name: names.get(r.user_id as string) ?? '',
        cohort: str(r.cohort),
        consent: consents.find((c) => c.studentId === r.user_id) ?? null,
      })),
      joinCodes: ((codes.data ?? []) as Row[]).map((c) => ({ code: c.code as string, cohort: str(c.cohort), expiresAt: str(c.expires_at) })),
    };
  }

  async createJoinCode(userId: string, organizationId: string, cohort: string | null) {
    const code = classCode();
    const { error } = await this.user.from('org_join_codes').insert({ org_id: organizationId, code, cohort, created_by: userId });
    if (error) fail(error);
    return { code };
  }

  async recordSchoolConsent(i: SchoolConsentInput) {
    // As the staff member: RLS (is_org_staff + student accepted membership) is the authority.
    const { data, error } = await this.user
      .from('consents')
      .insert({
        student_id: i.studentId,
        route: 'school',
        method: i.method,
        guardian_name: i.representativeName,
        guardian_relation: 'school',
        organization_id: i.organizationId,
        policy_version: i.policyVersion,
        evidence: i.evidence,
      })
      .select('*')
      .single();
    if (error) fail(error);
    const row = data as Row;
    return this.consentOf(row, await this.names([row.student_id as string]));
  }
}
