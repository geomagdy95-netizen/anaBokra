import type { UserContext } from '@anabokra/engine';

import type { ReadinessPhase, SessionKind } from '@/server/assessment/config';
import { RepoConflictError, RepoForbiddenError } from '@/server/assessment/errors';
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
} from '@/server/assessment/types';

import type { KvStore } from './kv';

/** Everything the assessment stores for one device profile, kept as one document. */
interface AssessmentDoc {
  v: 1;
  sessions: SessionRecord[];
  /** key: `${sessionId}:${itemId}` */
  responses: Record<string, ResponseRecord>;
  results: ResultRecord[];
  readiness: ReadinessRecord[];
  context: UserContext;
}

const emptyDoc = (): AssessmentDoc => ({ v: 1, sessions: [], responses: {}, results: [], readiness: [], context: {} });

export const assessmentKey = (profileId: string) => `assessment:${profileId}`;

export interface LocalRepoOptions {
  /** Whether this profile may take the assessment (the user has accepted the terms on the device). */
  hasConsent: () => Promise<boolean>;
  now?: () => Date;
}

/**
 * AssessmentRepo for phase 1: one device profile's data in the device's key-value store.
 * Same rules as the database (and MemoryAssessmentRepo): one open full session, the consent gate
 * on create / reactivate / answer, unique (session, item), one result per session.
 * Operations run one at a time, so overlapping saves from the UI can't overwrite each other.
 */
export class LocalAssessmentRepo implements AssessmentRepo {
  private doc: AssessmentDoc | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private now: () => Date;

  constructor(
    private readonly kv: KvStore,
    private readonly profileId: string,
    private readonly options: LocalRepoOptions,
  ) {
    this.now = options.now ?? (() => new Date());
  }

  /** Runs `fn` after every earlier operation; saves the document when `write` is set. */
  private run<T>(fn: (doc: AssessmentDoc) => T | Promise<T>, write = false): Promise<T> {
    const next = this.queue.then(async () => {
      this.doc ??= (await this.kv.get<AssessmentDoc>(assessmentKey(this.profileId))) ?? emptyDoc();
      const out = await fn(this.doc);
      if (write) await this.kv.set(assessmentKey(this.profileId), this.doc);
      return structuredClone(out);
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  private mine(userId: string) {
    return userId === this.profileId;
  }

  private async canTakeFull(userId: string) {
    return this.mine(userId) && (await this.options.hasConsent());
  }

  async getStartEligibility(userId: string): Promise<StartEligibility> {
    if (!this.mine(userId)) return 'not_student';
    return (await this.options.hasConsent()) ? 'ok' : 'consent_required';
  }

  findOpenSession(userId: string, kind: SessionKind) {
    return this.run((d) => {
      if (!this.mine(userId)) return null;
      return (
        d.sessions
          .filter((s) => s.kind === kind && (s.status === 'in_progress' || s.status === 'paused'))
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null
      );
    });
  }

  getSession(userId: string, sessionId: string) {
    return this.run((d) => (this.mine(userId) ? (d.sessions.find((s) => s.id === sessionId) ?? null) : null));
  }

  async createSession(input: NewSession) {
    const allowed = input.kind !== 'full' || (await this.canTakeFull(input.userId));
    return this.run((d) => {
      if (!this.mine(input.userId)) throw new RepoForbiddenError('other_profile');
      if (!allowed) throw new RepoForbiddenError('consent_required');
      if (input.kind === 'full' && d.sessions.some((s) => s.kind === 'full' && (s.status === 'in_progress' || s.status === 'paused')))
        throw new RepoConflictError('assessment_sessions_one_open_full');
      const s: SessionRecord = {
        id: crypto.randomUUID(),
        userId: input.userId,
        kind: input.kind,
        status: 'in_progress',
        station: input.station,
        stationsDone: [],
        progress: structuredClone(input.progress),
        instrumentVersionIds: [...input.instrumentVersionIds],
        locale: input.locale,
        startedAt: input.now,
        lastActiveAt: input.now,
        completedAt: null,
      };
      d.sessions.push(s);
      return s;
    }, true);
  }

  async updateSession(sessionId: string, patch: SessionPatch) {
    const consent = await this.options.hasConsent();
    return this.run((d) => {
      const s = d.sessions.find((x) => x.id === sessionId);
      if (!s) throw new Error('session not found');
      if (s.kind === 'full' && patch.status === 'in_progress' && s.status !== 'in_progress' && !consent)
        throw new RepoForbiddenError('consent_required');
      if (patch.status !== undefined) s.status = patch.status;
      if (patch.station !== undefined) s.station = patch.station;
      if (patch.stationsDone !== undefined) s.stationsDone = [...patch.stationsDone];
      if (patch.progress !== undefined) s.progress = structuredClone(patch.progress);
      if (patch.completedAt !== undefined) s.completedAt = patch.completedAt;
      s.lastActiveAt = patch.lastActiveAt;
      return s;
    }, true);
  }

  async resolveInstrumentVersionIds(pins: { instrumentId: string; version: string }[]) {
    // Instruments ship with the app, so the pin itself is the id.
    return pins.map((p) => `${p.instrumentId}@${p.version}`);
  }

  async upsertResponses(sessionId: string, userId: string, rows: ResponseRow[]) {
    const consent = await this.options.hasConsent();
    await this.run((d) => {
      const s = d.sessions.find((x) => x.id === sessionId);
      if (!s || !this.mine(userId) || s.status !== 'in_progress' || (s.kind === 'full' && !consent))
        throw new RepoForbiddenError('cannot_answer_session');
      for (const r of rows) d.responses[`${sessionId}:${r.itemId}`] = { sessionId, ...r };
    }, true);
  }

  listResponses(sessionId: string) {
    return this.run((d) => Object.values(d.responses).filter((r) => r.sessionId === sessionId));
  }

  getResult(sessionId: string) {
    return this.run((d) => d.results.find((r) => r.sessionId === sessionId) ?? null);
  }

  getLatestResult(userId: string) {
    return this.run((d) => {
      if (!this.mine(userId)) return null;
      return [...d.results].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
    });
  }

  insertResult(row: NewResult) {
    return this.run((d) => {
      const existing = d.results.find((r) => r.sessionId === row.sessionId);
      if (existing) return existing;
      const rec: ResultRecord = { ...structuredClone(row), id: crypto.randomUUID(), createdAt: this.now().toISOString() };
      d.results.push(rec);
      return rec;
    }, true);
  }

  getUserContext(userId: string) {
    return this.run((d) => (this.mine(userId) ? d.context : {}));
  }

  async updateUserContext(userId: string, patch: Partial<Record<keyof UserContext, UserContext[keyof UserContext] | null>>) {
    await this.run((d) => {
      if (!this.mine(userId)) throw new RepoForbiddenError('other_profile');
      const ctx = { ...d.context } as Record<string, unknown>;
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined) delete ctx[k];
        else ctx[k] = v;
      }
      d.context = ctx as UserContext;
    }, true);
  }

  findReadiness(userId: string, sessionId: string, phase: ReadinessPhase) {
    return this.run((d) => d.readiness.find((r) => r.userId === userId && r.sessionId === sessionId && r.phase === phase) ?? null);
  }

  upsertReadiness(row: ReadinessRow) {
    return this.run((d) => {
      if (!this.mine(row.userId)) throw new RepoForbiddenError('other_profile');
      const i = d.readiness.findIndex((r) => r.sessionId === row.sessionId && r.phase === row.phase);
      if (i >= 0) {
        const rec = { ...structuredClone(row), id: d.readiness[i]!.id };
        d.readiness[i] = rec;
        return rec;
      }
      const rec: ReadinessRecord = { ...structuredClone(row), id: crypto.randomUUID() };
      d.readiness.push(rec);
      return rec;
    }, true);
  }
}
