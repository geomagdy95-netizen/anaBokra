import type { UserContext } from '@anabokra/engine';

import type { ReadinessPhase, SessionKind } from './config';
import { RepoConflictError, RepoForbiddenError } from './errors';
import type {
  AssessmentRepo,
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

export interface MemoryRepoOptions {
  now?: () => Date;
}

/**
 * In-memory AssessmentRepo for unit tests. Mirrors the DB rules the service relies on:
 * one open full session per user, the consent gate (create / reactivate / answer), unique
 * (session, item), unique result per session. Records are cloned in and out like a database.
 */
export class MemoryAssessmentRepo implements AssessmentRepo {
  private sessions = new Map<string, SessionRecord>();
  private responses = new Map<string, ResponseRecord>(); // key: `${sessionId}:${itemId}`
  private results = new Map<string, ResultRecord>(); // key: sessionId
  private readiness: ReadinessRecord[] = [];
  private contexts = new Map<string, UserContext>();
  private people = new Map<string, { role: string; consent: boolean }>();
  private seq = 0;
  private now: () => Date;

  /** Test knobs / counters. */
  resultInserts = 0;

  constructor(options: MemoryRepoOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  /** Register a user. `needsConsent` = a minor without guardian consent yet. */
  addUser(userId: string, { role = 'student', needsConsent = false }: { role?: string; needsConsent?: boolean } = {}) {
    this.people.set(userId, { role, consent: !needsConsent });
  }
  grantConsent(userId: string) {
    this.person(userId).consent = true;
  }
  /** Withdrawing the last consent pauses the open full session (DB trigger consents_pause_sessions). */
  withdrawConsent(userId: string) {
    this.person(userId).consent = false;
    for (const s of this.sessions.values())
      if (s.userId === userId && s.kind === 'full' && s.status === 'in_progress') s.status = 'paused';
  }
  allResponses(sessionId: string) {
    return [...this.responses.values()].filter((r) => r.sessionId === sessionId);
  }
  allReadiness() {
    return structuredClone(this.readiness);
  }

  private person(userId: string) {
    const p = this.people.get(userId);
    if (!p) throw new Error(`unknown test user ${userId}`);
    return p;
  }
  private id(prefix: string) {
    this.seq += 1;
    // Valid v4-shaped uuid so zod's uuid() accepts it.
    return `${prefix}-0000-4000-8000-${String(this.seq).padStart(12, '0')}`;
  }
  private canTakeFull(userId: string) {
    const p = this.people.get(userId);
    return Boolean(p && p.role === 'student' && p.consent);
  }

  async getStartEligibility(userId: string): Promise<StartEligibility> {
    const p = this.person(userId);
    if (p.role !== 'student') return 'not_student';
    return p.consent ? 'ok' : 'consent_required';
  }

  async findOpenSession(userId: string, kind: SessionKind) {
    const open = [...this.sessions.values()]
      .filter((s) => s.userId === userId && s.kind === kind && (s.status === 'in_progress' || s.status === 'paused'))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    return open ? structuredClone(open) : null;
  }

  async getSession(userId: string, sessionId: string) {
    const s = this.sessions.get(sessionId);
    return s && s.userId === userId ? structuredClone(s) : null;
  }

  async createSession(input: NewSession) {
    if (input.kind === 'full' && !this.canTakeFull(input.userId)) throw new RepoForbiddenError('consent_required');
    if (
      input.kind === 'full' &&
      [...this.sessions.values()].some(
        (s) => s.userId === input.userId && s.kind === 'full' && (s.status === 'in_progress' || s.status === 'paused'),
      )
    )
      throw new RepoConflictError('assessment_sessions_one_open_full');
    const s: SessionRecord = {
      id: this.id('5e550000'),
      userId: input.userId,
      kind: input.kind,
      status: 'in_progress',
      station: input.station,
      stationsDone: [],
      progress: input.progress,
      instrumentVersionIds: input.instrumentVersionIds,
      locale: input.locale,
      startedAt: input.now,
      lastActiveAt: input.now,
      completedAt: null,
    };
    this.sessions.set(s.id, structuredClone(s));
    return structuredClone(s);
  }

  async updateSession(sessionId: string, patch: SessionPatch) {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error('session not found');
    if (s.kind === 'full' && patch.status === 'in_progress' && s.status !== 'in_progress' && !this.canTakeFull(s.userId))
      throw new RepoForbiddenError('consent_required');
    if (patch.status !== undefined) s.status = patch.status;
    if (patch.station !== undefined) s.station = patch.station;
    if (patch.stationsDone !== undefined) s.stationsDone = [...patch.stationsDone];
    if (patch.progress !== undefined) s.progress = structuredClone(patch.progress);
    if (patch.completedAt !== undefined) s.completedAt = patch.completedAt;
    s.lastActiveAt = patch.lastActiveAt;
    return structuredClone(s);
  }

  async resolveInstrumentVersionIds(pins: { instrumentId: string; version: string }[]) {
    return pins.map((p) => `iv-${p.instrumentId}-${p.version}`);
  }

  async upsertResponses(sessionId: string, userId: string, rows: ResponseRow[]) {
    const s = this.sessions.get(sessionId);
    // can_answer_session(): owner, open, and (full sessions) still allowed to take them
    if (!s || s.userId !== userId || s.status !== 'in_progress' || (s.kind === 'full' && !this.canTakeFull(userId)))
      throw new RepoForbiddenError('row-level security');
    for (const r of rows) this.responses.set(`${sessionId}:${r.itemId}`, { sessionId, ...r });
  }

  async listResponses(sessionId: string) {
    return structuredClone(this.allResponses(sessionId));
  }

  async getResult(sessionId: string) {
    const r = this.results.get(sessionId);
    return r ? structuredClone(r) : null;
  }

  async getLatestResult(userId: string) {
    const mine = [...this.results.values()].filter((r) => r.userId === userId);
    mine.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return mine[0] ? structuredClone(mine[0]) : null;
  }

  async insertResult(row: NewResult) {
    const existing = this.results.get(row.sessionId);
    if (existing) return structuredClone(existing);
    this.resultInserts += 1;
    const rec: ResultRecord = { ...structuredClone(row), id: this.id('7e500000'), createdAt: this.now().toISOString() };
    this.results.set(row.sessionId, rec);
    return structuredClone(rec);
  }

  async getUserContext(userId: string) {
    return structuredClone(this.contexts.get(userId) ?? {});
  }

  async updateUserContext(userId: string, patch: Partial<Record<keyof UserContext, UserContext[keyof UserContext] | null>>) {
    const ctx = { ...(this.contexts.get(userId) ?? {}) } as Record<string, unknown>;
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined) delete ctx[k];
      else ctx[k] = v;
    }
    this.contexts.set(userId, ctx as UserContext);
  }

  async findReadiness(userId: string, sessionId: string, phase: ReadinessPhase) {
    const r = this.readiness.find((x) => x.userId === userId && x.sessionId === sessionId && x.phase === phase);
    return r ? structuredClone(r) : null;
  }

  async upsertReadiness(row: ReadinessRow) {
    const i = this.readiness.findIndex(
      (r) => r.userId === row.userId && r.sessionId === row.sessionId && r.phase === row.phase,
    );
    if (i >= 0) {
      const rec = { ...structuredClone(row), id: this.readiness[i]!.id };
      this.readiness[i] = rec;
      return structuredClone(rec);
    }
    const rec: ReadinessRecord = { ...structuredClone(row), id: this.id('4ead0000') };
    this.readiness.push(rec);
    return structuredClone(rec);
  }
}
