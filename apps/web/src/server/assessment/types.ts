import type { UserContext } from '@anabokra/engine';

import type { ReadinessPhase, SessionKind } from './config';

export type Json = Record<string, unknown>;

export type SessionStatus = 'in_progress' | 'paused' | 'completed' | 'abandoned';

export interface SessionRecord {
  id: string;
  userId: string;
  kind: SessionKind;
  status: SessionStatus;
  /** Current station (the first station not yet completed), null once finished. */
  station: string | null;
  stationsDone: string[];
  /** UI resume state + server-owned bookkeeping (see SessionProgress). */
  progress: Json;
  instrumentVersionIds: string[];
  locale: 'ar' | 'en';
  startedAt: string;
  lastActiveAt: string;
  completedAt: string | null;
}

export interface NewSession {
  userId: string;
  kind: SessionKind;
  station: string;
  progress: Json;
  instrumentVersionIds: string[];
  locale: 'ar' | 'en';
  now: string;
}

export interface SessionPatch {
  status?: SessionStatus;
  station?: string | null;
  stationsDone?: string[];
  progress?: Json;
  lastActiveAt: string;
  completedAt?: string | null;
}

export interface ResponseRow {
  instrumentId: string;
  itemId: string;
  value: number;
  ms: number | null;
}

export interface ResponseRecord extends ResponseRow {
  sessionId: string;
}

export interface NewResult {
  userId: string;
  sessionId: string;
  assessmentVersion: string;
  engineVersion: string;
  normsVersion: string | null;
  scores: Json;
  matches: unknown[];
  context: UserContext;
  coverage: number;
  quality: Json;
  summary: Json;
}

export interface ResultRecord extends NewResult {
  id: string;
  createdAt: string;
}

export interface ReadinessRow {
  userId: string;
  sessionId: string | null;
  phase: ReadinessPhase;
  instrumentVersionId: string | null;
  answers: Record<string, number>;
  score: number;
  takenAt: string;
}

export interface ReadinessRecord extends ReadinessRow {
  id: string;
}

export type StartEligibility = 'ok' | 'not_student' | 'consent_required';

/**
 * Persistence port. The Supabase implementation uses the signed-in user's client (RLS) for
 * sessions / responses / readiness and the service_role client for results and instrument lookups.
 * The in-memory implementation backs unit tests and mirrors the DB constraints that matter
 * (one open full session, consent gate, unique (session, item), unique result per session).
 *
 * Error contract: `RepoConflictError` on unique violations, `RepoForbiddenError` when RLS / the
 * consent gate rejects a write. Anything else is an unexpected failure.
 */
export interface AssessmentRepo {
  getStartEligibility(userId: string): Promise<StartEligibility>;
  findOpenSession(userId: string, kind: SessionKind): Promise<SessionRecord | null>;
  /** Only returns the session if it belongs to `userId`. */
  getSession(userId: string, sessionId: string): Promise<SessionRecord | null>;
  createSession(input: NewSession): Promise<SessionRecord>;
  updateSession(sessionId: string, patch: SessionPatch): Promise<SessionRecord>;
  /** Maps (instrument id, version) pairs to instrument_versions ids; unknown pairs are skipped. */
  resolveInstrumentVersionIds(pins: { instrumentId: string; version: string }[]): Promise<string[]>;
  /** Idempotent: upsert by (session, item id). */
  upsertResponses(sessionId: string, userId: string, rows: ResponseRow[]): Promise<void>;
  listResponses(sessionId: string): Promise<ResponseRecord[]>;
  getResult(sessionId: string): Promise<ResultRecord | null>;
  /** The user's most recent result (by creation time), if any. */
  getLatestResult(userId: string): Promise<ResultRecord | null>;
  /** Idempotent: when a result already exists for the session, returns it unchanged. */
  insertResult(row: NewResult): Promise<ResultRecord>;
  getUserContext(userId: string): Promise<UserContext>;
  updateUserContext(userId: string, patch: Partial<Record<keyof UserContext, UserContext[keyof UserContext] | null>>): Promise<void>;
  /** Idempotent by (user, session, phase); a null session keeps one row per user and phase. */
  upsertReadiness(row: ReadinessRow): Promise<ReadinessRecord>;
  /** The saved check for (user, session, phase), if any. */
  findReadiness(userId: string, sessionId: string, phase: ReadinessPhase): Promise<ReadinessRecord | null>;
}

/** Server-owned part of sessions.progress. `ui` is the client's own resume cursor. */
export interface SessionProgress {
  assessmentVersion: string;
  instrumentVersions: Record<string, string>;
  context?: UserContext;
  valuesRanking?: string[];
  ui?: Json;
}
