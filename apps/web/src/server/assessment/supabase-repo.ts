import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserContext } from '@anabokra/engine';

import type { ReadinessPhase, SessionKind } from './config';
import { RepoConflictError, RepoForbiddenError } from './errors';
import type {
  AssessmentRepo,
  Json,
  NewResult,
  NewSession,
  ReadinessRecord,
  ReadinessRow,
  ResponseRecord,
  ResponseRow,
  ResultRecord,
  SessionPatch,
  SessionRecord,
  StartEligibility,
} from './types';

interface PgError {
  code?: string;
  message?: string;
}

/** Postgres / PostgREST error -> repository signal. */
function fail(error: PgError): never {
  const msg = error.message ?? '';
  if (error.code === '23505') throw new RepoConflictError(msg);
  // 42501 = insufficient_privilege (RLS violation, consent-gate trigger, frozen rows)
  if (error.code === '42501' || /row-level security|consent_required/i.test(msg)) throw new RepoForbiddenError(msg);
  throw new Error(`[assessment-repo] ${error.code ?? ''} ${msg}`);
}

const ok = <T>(r: { data: T | null; error: PgError | null }): T | null => {
  if (r.error) fail(r.error);
  return r.data;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from an untyped client */
const toSession = (r: any): SessionRecord => ({
  id: r.id,
  userId: r.user_id,
  kind: r.kind,
  status: r.status,
  station: r.station,
  stationsDone: r.stations_done ?? [],
  progress: r.progress ?? {},
  instrumentVersionIds: r.instrument_version_ids ?? [],
  locale: r.locale,
  startedAt: r.started_at,
  lastActiveAt: r.last_active_at,
  completedAt: r.completed_at,
});

const toResult = (r: any): ResultRecord => ({
  id: r.id,
  userId: r.user_id,
  sessionId: r.session_id,
  assessmentVersion: r.assessment_version,
  engineVersion: r.engine_version,
  normsVersion: r.norms_version,
  scores: r.scores,
  matches: r.matches,
  context: r.context,
  coverage: Number(r.coverage),
  quality: r.quality,
  summary: r.summary,
  createdAt: r.created_at,
});

const toReadiness = (r: any): ReadinessRecord => ({
  id: r.id,
  userId: r.user_id,
  sessionId: r.session_id,
  phase: r.phase,
  instrumentVersionId: r.instrument_version_id,
  answers: r.answers,
  score: Number(r.score),
  takenAt: r.taken_at,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Supabase implementation.
 *  - `user`: the signed-in user's client (cookie session, RLS applies): sessions, responses,
 *    readiness, profile context, consent check.
 *  - `admin`: service_role client: results (no end-user write policy) and instrument_versions lookups.
 * Results are only ever written through `admin`; every method scopes by the authenticated user id
 * passed in by the (already authenticated) service layer.
 */
export class SupabaseAssessmentRepo implements AssessmentRepo {
  constructor(
    private readonly user: SupabaseClient,
    private readonly admin: SupabaseClient,
  ) {}

  async getStartEligibility(userId: string): Promise<StartEligibility> {
    const profile = ok(await this.user.from('profiles').select('role').eq('id', userId).maybeSingle());
    if (!profile || (profile as { role: string }).role !== 'student') return 'not_student';
    // can_start_full_assessment(): student AND (18+ OR active 'assessment' consent). Unknown DOB = minor.
    const allowed = ok(await this.user.rpc('can_start_full_assessment', { p_user: userId }));
    return allowed === true ? 'ok' : 'consent_required';
  }

  async findOpenSession(userId: string, kind: SessionKind) {
    const rows = ok(
      await this.user
        .from('assessment_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('kind', kind)
        .in('status', ['in_progress', 'paused'])
        .order('started_at', { ascending: false })
        .limit(1),
    );
    return rows && rows.length ? toSession(rows[0]) : null;
  }

  async getSession(userId: string, sessionId: string) {
    const row = ok(await this.user.from('assessment_sessions').select('*').eq('id', sessionId).eq('user_id', userId).maybeSingle());
    return row ? toSession(row) : null;
  }

  async createSession(input: NewSession) {
    const row = ok(
      await this.user
        .from('assessment_sessions')
        .insert({
          user_id: input.userId,
          kind: input.kind,
          status: 'in_progress',
          station: input.station,
          progress: input.progress,
          instrument_version_ids: input.instrumentVersionIds,
          locale: input.locale,
          started_at: input.now,
          last_active_at: input.now,
        })
        .select('*')
        .single(),
    );
    return toSession(row);
  }

  async updateSession(sessionId: string, patch: SessionPatch) {
    const set: Record<string, unknown> = { last_active_at: patch.lastActiveAt };
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.station !== undefined) set.station = patch.station;
    if (patch.stationsDone !== undefined) set.stations_done = patch.stationsDone;
    if (patch.progress !== undefined) set.progress = patch.progress;
    if (patch.completedAt !== undefined) set.completed_at = patch.completedAt;
    const row = ok(await this.user.from('assessment_sessions').update(set).eq('id', sessionId).select('*').single());
    return toSession(row);
  }

  async resolveInstrumentVersionIds(pins: { instrumentId: string; version: string }[]) {
    if (!pins.length) return [];
    const rows = ok(
      await this.admin
        .from('instrument_versions')
        .select('id, instrument_id, version')
        .in('instrument_id', [...new Set(pins.map((p) => p.instrumentId))]),
    ) as { id: string; instrument_id: string; version: string }[] | null;
    return pins.flatMap((p) => {
      const hit = rows?.find((r) => r.instrument_id === p.instrumentId && r.version === p.version);
      return hit ? [hit.id] : [];
    });
  }

  async upsertResponses(sessionId: string, userId: string, rows: ResponseRow[]) {
    const at = new Date().toISOString();
    ok(
      await this.user.from('responses').upsert(
        rows.map((r) => ({
          session_id: sessionId,
          user_id: userId,
          instrument_id: r.instrumentId,
          item_id: r.itemId,
          value: r.value,
          ms: r.ms,
          answered_at: at,
        })),
        { onConflict: 'session_id,item_id' },
      ),
    );
  }

  async listResponses(sessionId: string): Promise<ResponseRecord[]> {
    const rows = ok(
      await this.user.from('responses').select('session_id, instrument_id, item_id, value, ms').eq('session_id', sessionId).order('item_id'),
    ) as { session_id: string; instrument_id: string; item_id: string; value: number | string; ms: number | null }[] | null;
    return (rows ?? []).map((r) => ({
      sessionId: r.session_id,
      instrumentId: r.instrument_id,
      itemId: r.item_id,
      value: Number(r.value),
      ms: r.ms,
    }));
  }

  async getResult(sessionId: string) {
    // service_role: the owner check already happened in getSession().
    const row = ok(await this.admin.from('results').select('*').eq('session_id', sessionId).maybeSingle());
    return row ? toResult(row) : null;
  }

  async getLatestResult(userId: string) {
    // service_role, scoped to the caller's id (never a client-supplied one).
    const rows = ok(
      await this.admin.from('results').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
    ) as unknown[] | null;
    return rows && rows.length ? toResult(rows[0]) : null;
  }

  async insertResult(row: NewResult) {
    const { data, error } = await this.admin
      .from('results')
      .upsert(
        {
          user_id: row.userId,
          session_id: row.sessionId,
          assessment_version: row.assessmentVersion,
          engine_version: row.engineVersion,
          norms_version: row.normsVersion,
          scores: row.scores,
          matches: row.matches,
          context: row.context,
          coverage: row.coverage,
          quality: row.quality,
          summary: row.summary,
        },
        { onConflict: 'session_id', ignoreDuplicates: true },
      )
      .select('*');
    if (error) fail(error);
    // ignoreDuplicates returns no row when one already exists: read it back (first writer wins).
    if (data && data.length) return toResult(data[0]);
    const existing = await this.getResult(row.sessionId);
    if (!existing) throw new Error('[assessment-repo] result vanished after conflict');
    return existing;
  }

  async getUserContext(userId: string): Promise<UserContext> {
    const p = ok(
      await this.user.from('profiles').select('curriculum, track, expected_score_pct, budget').eq('id', userId).maybeSingle(),
    ) as { curriculum: UserContext['curriculum'] | null; track: string | null; expected_score_pct: number | string | null; budget: UserContext['budget'] | null } | null;
    if (!p) return {};
    return {
      ...(p.curriculum ? { curriculum: p.curriculum } : {}),
      ...(p.track ? { track: p.track } : {}),
      ...(p.expected_score_pct !== null ? { expectedScorePct: Number(p.expected_score_pct) } : {}),
      ...(p.budget ? { budget: p.budget } : {}),
    };
  }

  async updateUserContext(userId: string, patch: Partial<Record<keyof UserContext, UserContext[keyof UserContext] | null>>) {
    const set: Record<string, unknown> = {};
    if (patch.curriculum !== undefined) set.curriculum = patch.curriculum;
    if (patch.track !== undefined) set.track = patch.track;
    if (patch.expectedScorePct !== undefined) set.expected_score_pct = patch.expectedScorePct;
    if (patch.budget !== undefined) set.budget = patch.budget;
    if (!Object.keys(set).length) return;
    ok(await this.user.from('profiles').update(set).eq('id', userId));
  }

  async findReadiness(userId: string, sessionId: string, phase: ReadinessPhase) {
    const rows = ok(
      await this.user
        .from('readiness_checks')
        .select('*')
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .eq('phase', phase)
        .order('taken_at', { ascending: false })
        .limit(1),
    ) as unknown[] | null;
    return rows?.length ? toReadiness(rows[0]) : null;
  }

  async upsertReadiness(row: ReadinessRow) {
    // Partial unique index (session_id, phase) can't be an ON CONFLICT target through PostgREST,
    // so look the row up first. A null session keeps one row per user and phase.
    let q = this.user.from('readiness_checks').select('id').eq('user_id', row.userId).eq('phase', row.phase);
    q = row.sessionId ? q.eq('session_id', row.sessionId) : q.is('session_id', null);
    const existing = ok(await q.order('taken_at', { ascending: false }).limit(1)) as { id: string }[] | null;
    const payload = {
      user_id: row.userId,
      session_id: row.sessionId,
      instrument_version_id: row.instrumentVersionId,
      phase: row.phase,
      answers: row.answers as Json,
      score: row.score,
      taken_at: row.takenAt,
    };
    const update = async (id: string) =>
      ok(await this.user.from('readiness_checks').update(payload).eq('id', id).select('*').single());
    let saved: unknown;
    if (existing?.length) {
      saved = await update(existing[0]!.id);
    } else {
      const ins = await this.user.from('readiness_checks').insert(payload).select('*').single();
      if (ins.error?.code === '23505') {
        // Concurrent save of the same (session, phase): update the winner's row.
        const again = ok(await q.order('taken_at', { ascending: false }).limit(1)) as { id: string }[] | null;
        if (!again?.length) fail(ins.error);
        saved = await update(again![0]!.id);
      } else {
        saved = ok(ins);
      }
    }
    return toReadiness(saved);
  }
}
