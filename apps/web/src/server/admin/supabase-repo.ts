import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { maskPhone } from '@/server/otp/phone';

import { ADMIN_ROLES, type AdminRepo, type AdminRole, type AuditEntry, type FeatureFlag, type Overview, type ResponseSample, type UserDetail, type UserRow } from './types';

const STATIONS = ['interests', 'personality', 'values', 'abilities'];
const PAGE = 1000;
const MAX_RESPONSE_ROWS = 200_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown>;
type CountQuery = ReturnType<ReturnType<SupabaseClient['from']>['select']>;

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`admin_query_failed: ${res.error.message}`);
  return res.data;
}

/** Collects quality flag names from the per-instrument quality reports stored on a result. */
function qualityFlags(quality: unknown): string[] {
  if (!quality || typeof quality !== 'object') return [];
  const out = new Set<string>();
  for (const v of Object.values(quality as Record<string, unknown>)) {
    const flags = (v as { flags?: unknown })?.flags;
    if (Array.isArray(flags)) flags.forEach((f) => typeof f === 'string' && out.add(f));
  }
  return [...out];
}

/**
 * Service-role reads for the back office. Never call without passing requireAdmin() first:
 * this client bypasses RLS.
 */
export class SupabaseAdminRepo implements AdminRepo {
  readonly demo = false;
  constructor(private readonly db: SupabaseClient) {}

  private async count(table: string, filter: (q: CountQuery) => CountQuery = (q) => q): Promise<number> {
    const { count, error } = await filter(this.db.from(table).select('*', { count: 'exact', head: true }));
    if (error) throw new Error(`admin_query_failed: ${error.message}`);
    return count ?? 0;
  }

  async getAdminRoles(userId: string): Promise<AdminRole[]> {
    const rows = check(await this.db.from('admin_roles').select('role').eq('user_id', userId).is('revoked_at', null)) as Row[];
    return rows.map((r) => r.role as AdminRole).filter((r) => (ADMIN_ROLES as readonly string[]).includes(r));
  }

  async overview(): Promise<Overview> {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [total, students, parents, newLast7d, started, completed, results, active, withdrawn, ...stationCounts] = await Promise.all([
      this.count('profiles'),
      this.count('profiles', (q) => q.eq('role', 'student')),
      this.count('profiles', (q) => q.eq('role', 'parent')),
      this.count('profiles', (q) => q.gte('created_at', weekAgo)),
      this.count('assessment_sessions', (q) => q.eq('kind', 'full')),
      this.count('assessment_sessions', (q) => q.eq('kind', 'full').eq('status', 'completed')),
      this.count('results'),
      this.count('consents', (q) => q.is('withdrawn_at', null)),
      this.count('consents', (q) => q.not('withdrawn_at', 'is', null)),
      ...STATIONS.map((st) => this.count('assessment_sessions', (q) => q.eq('kind', 'full').contains('stations_done', [st]))),
    ]);
    return {
      users: { total, students, parents, newLast7d },
      sessions: { started, inProgress: started - completed, completed },
      results,
      consents: { active, withdrawn },
      funnel: [
        { step: 'students', count: students },
        { step: 'started', count: started },
        ...STATIONS.map((step, i) => ({ step, count: stationCounts[i] ?? 0 })),
        { step: 'result', count: results },
      ],
    };
  }

  private async decorate(profiles: Row[]): Promise<UserRow[]> {
    const ids = profiles.map((p) => p.id as string);
    if (!ids.length) return [];
    const [consents, results] = await Promise.all([
      this.db.from('consents').select('student_id, withdrawn_at').in('student_id', ids),
      this.db.from('results').select('user_id').in('user_id', ids),
    ]);
    const consentRows = check(consents) as Row[];
    const withResult = new Set((check(results) as Row[]).map((r) => r.user_id as string));
    return profiles.map((p) => {
      const mine = consentRows.filter((c) => c.student_id === p.id);
      const consent: UserRow['consent'] = mine.some((c) => !c.withdrawn_at) ? 'active' : mine.length ? 'withdrawn' : 'none';
      return {
        id: p.id as string,
        displayName: (p.display_name as string) || '—',
        role: p.role as string,
        governorate: (p.governorate as string) ?? null,
        curriculum: (p.curriculum as string) ?? null,
        createdAt: p.created_at as string,
        lastSeenAt: (p.last_seen_at as string) ?? null,
        consent,
        hasResult: withResult.has(p.id as string),
      };
    });
  }

  async listUsers({ q, role, limit, offset }: { q?: string; role?: string; limit: number; offset: number }) {
    let query = this.db
      .from('profiles')
      .select('id, display_name, role, governorate, curriculum, created_at, last_seen_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (role) query = query.eq('role', role);
    const needle = q?.trim();
    if (needle) query = UUID.test(needle) ? query.eq('id', needle) : query.ilike('display_name', `%${needle.replace(/[%_]/g, '')}%`);
    const res = await query;
    const rows = check(res) as Row[];
    return { rows: await this.decorate(rows), total: res.count ?? rows.length };
  }

  async getUser(id: string): Promise<UserDetail | null> {
    if (!UUID.test(id)) return null;
    const profile = check(
      await this.db.from('profiles').select('id, display_name, role, governorate, curriculum, created_at, last_seen_at, gender, grade, date_of_birth, phone').eq('id', id).maybeSingle(),
    ) as Row | null;
    if (!profile) return null;
    const [[row], consents, sessions, result] = await Promise.all([
      this.decorate([profile]),
      this.db.from('consents').select('id, route, method, policy_version, granted_at, withdrawn_at').eq('student_id', id).order('granted_at', { ascending: false }),
      this.db.from('assessment_sessions').select('id, status, stations_done, started_at, completed_at').eq('user_id', id).order('started_at', { ascending: false }).limit(20),
      this.db.from('results').select('created_at, summary, quality, coverage').eq('user_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const latest = check(result) as Row | null;
    const summary = (latest?.summary ?? {}) as { hollandCode?: string; topCareerIds?: string[] };
    return {
      profile: {
        ...row!,
        gender: (profile.gender as string) ?? null,
        grade: (profile.grade as number) ?? null,
        dateOfBirth: (profile.date_of_birth as string) ?? null,
        phoneMasked: profile.phone ? maskPhone(profile.phone as string) : null,
      },
      consents: (check(consents) as Row[]).map((c) => ({
        id: c.id as string,
        route: c.route as string,
        method: c.method as string,
        policyVersion: c.policy_version as string,
        grantedAt: c.granted_at as string,
        withdrawnAt: (c.withdrawn_at as string) ?? null,
      })),
      sessions: (check(sessions) as Row[]).map((s) => ({
        id: s.id as string,
        status: s.status as string,
        stationsDone: (s.stations_done as string[]) ?? [],
        startedAt: s.started_at as string,
        completedAt: (s.completed_at as string) ?? null,
      })),
      latestResult: latest
        ? {
            createdAt: latest.created_at as string,
            hollandCode: summary.hollandCode ?? null,
            topCareerIds: summary.topCareerIds ?? [],
            quality: qualityFlags(latest.quality),
            coverage: latest.coverage === null || latest.coverage === undefined ? null : Number(latest.coverage),
          }
        : null,
    };
  }

  async responsesFor(instrumentId: string): Promise<ResponseSample[]> {
    const out: ResponseSample[] = [];
    for (let from = 0; from < MAX_RESPONSE_ROWS; from += PAGE) {
      const rows = check(
        await this.db.from('responses').select('session_id, item_id, value, ms').eq('instrument_id', instrumentId).order('id').range(from, from + PAGE - 1),
      ) as Row[];
      for (const r of rows) out.push({ sessionId: r.session_id as string, itemId: r.item_id as string, value: Number(r.value), ms: (r.ms as number) ?? null });
      if (rows.length < PAGE) break;
    }
    return out;
  }

  async listFlags(): Promise<FeatureFlag[]> {
    const rows = check(await this.db.from('feature_flags').select('key, enabled, rollout_pct, description, updated_at').order('key')) as Row[];
    return rows.map((r) => ({ key: r.key as string, enabled: !!r.enabled, rolloutPct: r.rollout_pct as number, description: (r.description as string) ?? null, updatedAt: r.updated_at as string }));
  }

  async setFlag(key: string, enabled: boolean, actorId: string): Promise<FeatureFlag> {
    const r = check(
      await this.db.from('feature_flags').update({ enabled, updated_by: actorId }).eq('key', key).select('key, enabled, rollout_pct, description, updated_at').maybeSingle(),
    ) as Row | null;
    if (!r) throw new Error('unknown_flag');
    return { key: r.key as string, enabled: !!r.enabled, rolloutPct: r.rollout_pct as number, description: (r.description as string) ?? null, updatedAt: r.updated_at as string };
  }

  async auditLog({ limit, entityType }: { limit: number; entityType?: string }): Promise<AuditEntry[]> {
    let q = this.db.from('audit_log').select('id, actor_id, actor_role, action, entity_type, entity_id, context, created_at').order('created_at', { ascending: false }).limit(limit);
    if (entityType) q = q.eq('entity_type', entityType);
    const rows = check(await q) as Row[];
    return rows.map((r) => ({
      id: r.id as string,
      actorId: (r.actor_id as string) ?? null,
      actorRole: (r.actor_role as string) ?? null,
      action: r.action as string,
      entityType: r.entity_type as string,
      entityId: (r.entity_id as string) ?? null,
      changedFields: ((r.context as { changed_fields?: string[] })?.changed_fields ?? []) as string[],
      createdAt: r.created_at as string,
    }));
  }

  async ping() {
    const { error } = await this.db.from('app_settings').select('key', { head: true, count: 'exact' });
    return !error;
  }
}
