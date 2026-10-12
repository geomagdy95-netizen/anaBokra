import { instruments } from '@anabokra/content';
import { scoreLikert, WORK_VALUES, type UserContext } from '@anabokra/engine';
import type { ZodType } from 'zod';

import {
  ASSESSMENT_VERSION,
  contextFieldsFor,
  currentInstrumentVersions,
  READINESS,
  stationConfig,
  stationsFor,
  likert,
  valuesInstrument,
  type SessionKind,
  type StationConfig,
} from './config';
import { AssessmentError, RepoConflictError, RepoForbiddenError } from './errors';
import { retakeStatus, type RetakeStatus } from './retake';
import { stationItems } from './items';
import {
  completeStationSchema,
  readinessSchema,
  saveContextSchema,
  saveResponsesSchema,
  sessionRefSchema,
  startSessionSchema,
} from './schemas';
import {
  scoreAbilityStation,
  scoreInterests,
  scorePersonality,
  scoreSession,
  scoreValueCards,
  previewSuggestions,
} from './scoring';
import type {
  AssessmentRepo,
  Json,
  ReadinessRecord,
  ResponseRecord,
  ResultRecord,
  SessionProgress,
  SessionRecord,
} from './types';

export interface ServiceDeps {
  repo: AssessmentRepo;
  now?: () => Date;
}

export interface StationProgress {
  id: string;
  instrumentId: string | null;
  version: string | null;
  answered: number;
  expected: number;
  done: boolean;
  required: boolean;
}

export interface ProgressView {
  sessionId: string;
  kind: SessionKind;
  status: SessionRecord['status'];
  currentStation: string | null;
  stations: StationProgress[];
  overall: { answered: number; expected: number };
  /** True once finalize() could score at least one station. */
  canFinalize: boolean;
  hasResult: boolean;
  /** UI resume cursor last stored with saveResponses. */
  cursor: Json | null;
}

export type EntryState =
  | { kind: 'open' }
  | { kind: 'new' }
  | { kind: 'results'; sessionId: string; completedAt: string; retake: RetakeStatus };

function parse<T>(schema: ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) {
    // Only paths and messages: never echo submitted values.
    throw new AssessmentError(
      'invalid_input',
      'Invalid request',
      r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return r.data;
}

const progressOf = (s: SessionRecord): SessionProgress => s.progress as unknown as SessionProgress;

/** Run a repo write, translating gate / uniqueness signals. */
async function guarded<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof RepoForbiddenError) throw new AssessmentError('consent_required', 'Guardian consent is required');
    throw e;
  }
}

export function createAssessmentService({ repo, now = () => new Date() }: ServiceDeps) {
  const iso = () => now().toISOString();

  async function loadSession(userId: string, sessionId: string): Promise<SessionRecord> {
    const s = await repo.getSession(userId, sessionId);
    if (!s) throw new AssessmentError('not_found', 'Session not found');
    return s;
  }

  function assertPinnedVersions(s: SessionRecord) {
    const pinned = progressOf(s).instrumentVersions ?? {};
    const current = currentInstrumentVersions(s.kind);
    for (const [id, v] of Object.entries(pinned)) {
      if (current[id] !== v) {
        throw new AssessmentError('instrument_version_mismatch', 'This session was started with a different instrument version', {
          instrumentId: id,
          pinned: v,
          current: current[id] ?? null,
        });
      }
    }
  }

  function assertOpen(s: SessionRecord) {
    if (s.status === 'in_progress') return;
    if (s.status === 'paused') throw new AssessmentError('session_paused', 'Session is paused');
    throw new AssessmentError('session_closed', 'Session is closed');
  }

  function station(s: SessionRecord, id: string): StationConfig {
    const cfg = stationConfig(s.kind, id);
    if (!cfg) throw new AssessmentError('invalid_station', 'Unknown station for this session', { station: id });
    return cfg;
  }

  const countAnswered = (responses: ResponseRecord[], instrumentId: string) =>
    responses.filter((r) => r.instrumentId === instrumentId).length;

  /** Can the engine score this station from what is stored? */
  function stationScorable(cfg: StationConfig, s: SessionRecord, responses: ResponseRecord[]): boolean {
    switch (cfg.id) {
      case 'interests':
        return Boolean(scoreInterests(responses));
      case 'personality':
        return Boolean(scorePersonality(responses));
      case 'values':
        return Boolean(scoreValueCards(responses, progressOf(s).valuesRanking));
      case 'abilities':
        return Boolean(scoreAbilityStation(responses));
      case 'context':
        return true;
    }
  }

  function contextAnswered(ctx: UserContext | undefined): number {
    return contextFieldsFor(ctx).filter((f) => ctx?.[f] !== undefined && ctx?.[f] !== null).length;
  }

  function buildProgress(s: SessionRecord, responses: ResponseRecord[], hasResult: boolean): ProgressView {
    const stations = stationsFor(s.kind).map<StationProgress>((cfg) => {
      const instrumentId = cfg.instrumentId;
      const expected = cfg.id === 'context' ? contextFieldsFor(progressOf(s).context).length : stationItems(cfg.id).expected;
      const answered =
        cfg.id === 'context' ? contextAnswered(progressOf(s).context) : countAnswered(responses, instrumentId!);
      return {
        id: cfg.id,
        instrumentId,
        version: instrumentId ? instruments[instrumentId].version : null,
        answered,
        expected,
        done: s.stationsDone.includes(cfg.id),
        required: cfg.required,
      };
    });
    const scored = stations.filter((st) => st.id !== 'context');
    const canFinalize = stationsFor(s.kind).some((cfg) => cfg.id !== 'context' && stationScorable(cfg, s, responses));
    return {
      sessionId: s.id,
      kind: s.kind,
      status: s.status,
      currentStation: s.status === 'completed' ? null : (stations.find((st) => !st.done)?.id ?? null),
      stations,
      overall: {
        answered: scored.reduce((n, st) => n + st.answered, 0),
        expected: scored.reduce((n, st) => n + st.expected, 0),
      },
      canFinalize,
      hasResult,
      cursor: (progressOf(s).ui as Json | undefined) ?? null,
    };
  }

  async function viewOf(s: SessionRecord): Promise<ProgressView> {
    const [responses, result] = await Promise.all([repo.listResponses(s.id), repo.getResult(s.id)]);
    return buildProgress(s, responses, result !== null);
  }

  // -------------------------------------------------------------------------

  /**
   * Start a session, or resume the open one (one open full session per student).
   * Full sessions need an active guardian consent for minors (also enforced by RLS + trigger).
   */
  async function startSession(userId: string, rawInput: unknown) {
    const input = parse(startSessionSchema, rawInput);
    if (input.kind === 'full') {
      const eligibility = await repo.getStartEligibility(userId);
      if (eligibility === 'not_student') throw new AssessmentError('not_student', 'Only student accounts take the assessment');
      if (eligibility === 'consent_required')
        throw new AssessmentError('consent_required', 'A guardian must consent before a minor starts the full assessment');
    }

    let session = await repo.findOpenSession(userId, input.kind);
    let resumed = Boolean(session);
    if (session) {
      assertPinnedVersions(session);
      if (session.status === 'paused') {
        session = await guarded(() => repo.updateSession(session!.id, { status: 'in_progress', lastActiveAt: iso() }));
      }
    } else {
      const versions = currentInstrumentVersions(input.kind);
      const progress: SessionProgress = { assessmentVersion: ASSESSMENT_VERSION, instrumentVersions: versions };
      const first = stationsFor(input.kind)[0]!.id;
      try {
        session = await guarded(async () =>
          repo.createSession({
            userId,
            kind: input.kind,
            station: first,
            progress: progress as unknown as Json,
            instrumentVersionIds: await repo.resolveInstrumentVersionIds(
              Object.entries(versions).map(([instrumentId, version]) => ({ instrumentId, version })),
            ),
            locale: input.locale,
            now: iso(),
          }),
        );
      } catch (e) {
        // Lost a race with a concurrent start: resume the winner.
        if (!(e instanceof RepoConflictError)) throw e;
        session = await repo.findOpenSession(userId, input.kind);
        if (!session) throw e;
        resumed = true;
      }
    }
    return { resumed, session: { id: session.id, kind: session.kind, locale: session.locale }, progress: await viewOf(session) };
  }

  /** Batched, idempotent save for one station. */
  async function saveResponses(userId: string, rawInput: unknown) {
    const input = parse(saveResponsesSchema, rawInput);
    const s = await loadSession(userId, input.sessionId);
    assertOpen(s);
    assertPinnedVersions(s);
    const cfg = station(s, input.station);
    if (!cfg.instrumentId || cfg.id === 'context')
      throw new AssessmentError('invalid_station', 'This station takes no item responses; use saveContext', { station: cfg.id });
    const catalog = stationItems(cfg.id);

    // Last write wins for repeated ids inside one batch.
    const byItem = new Map<string, (typeof input.responses)[number]>();
    for (const r of input.responses) byItem.set(r.itemId, r);

    const problems: { itemId: string; reason: string }[] = [];
    for (const r of byItem.values()) {
      const spec = catalog.specs.get(r.itemId);
      if (!spec) {
        problems.push({ itemId: r.itemId, reason: 'unknown_item' });
        continue;
      }
      const ok =
        spec.rule.type === 'integer'
          ? Number.isInteger(r.value) && r.value >= spec.rule.min && r.value <= spec.rule.max
          : spec.rule.allowed.includes(r.value);
      if (!ok) problems.push({ itemId: r.itemId, reason: 'value_out_of_range' });
    }
    if (problems.length) {
      const unknown = problems.some((p) => p.reason === 'unknown_item');
      throw new AssessmentError(unknown ? 'invalid_item' : 'invalid_value', 'Rejected responses; nothing was saved', problems);
    }

    if (cfg.id === 'values') {
      // "Must have" is capped (forces prioritisation). Count after merging this batch.
      const inst = valuesInstrument();
      const must = inst.buckets.find((b) => b.id === 'must');
      if (must?.limit !== undefined) {
        const merged = new Map(
          (await repo.listResponses(s.id)).filter((r) => r.instrumentId === 'values').map((r) => [r.itemId, r.value]),
        );
        for (const r of byItem.values()) merged.set(r.itemId, r.value);
        const count = [...merged.values()].filter((v) => v === must.weight).length;
        if (count > must.limit)
          throw new AssessmentError('values_limit_exceeded', `At most ${must.limit} cards can be "must have"`, {
            limit: must.limit,
            count,
          });
      }
    }

    await guarded(() =>
      repo.upsertResponses(
        s.id,
        userId,
        [...byItem.values()].map((r) => ({
          instrumentId: cfg.instrumentId!,
          itemId: r.itemId,
          value: r.value,
          ms: r.ms ?? null,
        })),
      ),
    );

    const progress: SessionProgress = { ...progressOf(s), ...(input.cursor ? { ui: input.cursor } : {}) };
    const updated = await repo.updateSession(s.id, {
      station: s.stationsDone.includes(cfg.id) ? s.station : cfg.id,
      progress: progress as unknown as Json,
      lastActiveAt: iso(),
    });
    const view = await viewOf(updated);
    return { saved: byItem.size, station: view.stations.find((st) => st.id === cfg.id)!, progress: view };
  }

  /** Context station: stage, then school (curriculum, track, expected score) or study (field, year), and budget. Mirrored to the profile. */
  async function saveContext(userId: string, rawInput: unknown) {
    const input = parse(saveContextSchema, rawInput);
    const s = await loadSession(userId, input.sessionId);
    assertOpen(s);
    station(s, 'context');
    const patch = input.context;
    await repo.updateUserContext(userId, patch);
    const merged: UserContext = { ...(progressOf(s).context ?? {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined) delete (merged as Record<string, unknown>)[k];
      else (merged as Record<string, unknown>)[k] = v;
    }
    const progress: SessionProgress = { ...progressOf(s), context: merged };
    const updated = await repo.updateSession(s.id, { progress: progress as unknown as Json, lastActiveAt: iso() });
    return { progress: await viewOf(updated) };
  }

  async function getProgress(userId: string, rawInput: unknown) {
    const { sessionId } = parse(sessionRefSchema, rawInput);
    return viewOf(await loadSession(userId, sessionId));
  }

  /**
   * Discover: path suggestions from the answers so far (early guess, then suggestions). Read-only:
   * nothing is stored and the session stays open. Own sessions only.
   */
  async function preview(userId: string, rawInput: unknown) {
    const { sessionId } = parse(sessionRefSchema, rawInput);
    const s = await loadSession(userId, sessionId);
    const progress = progressOf(s);
    const responses = await repo.listResponses(s.id);
    const context = progress.context ?? (await repo.getUserContext(userId));
    return previewSuggestions(responses, { valuesRanking: progress.valuesRanking, context });
  }

  /**
   * Everything the UI needs to resume exactly where the user left off: stored answers, the
   * context fields and the chosen values ranking. Own sessions only.
   */
  async function getResume(userId: string, rawInput: unknown) {
    const { sessionId } = parse(sessionRefSchema, rawInput);
    const s = await loadSession(userId, sessionId);
    const progress = progressOf(s);
    const responses = await repo.listResponses(s.id);
    return {
      responses: responses.map((r) => ({ instrumentId: r.instrumentId, itemId: r.itemId, value: r.value })),
      context: progress.context ?? (await repo.getUserContext(userId)),
      valuesRanking: progress.valuesRanking ?? [],
    };
  }

  /** Mark a station done once the engine can score it. Idempotent. */
  async function completeStation(userId: string, rawInput: unknown) {
    const input = parse(completeStationSchema, rawInput);
    const s = await loadSession(userId, input.sessionId);
    assertOpen(s);
    const cfg = station(s, input.station);

    if (input.valuesRanking) {
      if (cfg.id !== 'values') throw new AssessmentError('invalid_input', 'valuesRanking only applies to the values station');
      const uniq = new Set(input.valuesRanking);
      if (uniq.size !== input.valuesRanking.length || !input.valuesRanking.every((v) => (WORK_VALUES as readonly string[]).includes(v)))
        throw new AssessmentError('invalid_input', 'valuesRanking must list distinct work values');
    }

    const responses = await repo.listResponses(s.id);
    const progress: SessionProgress = {
      ...progressOf(s),
      ...(input.valuesRanking ? { valuesRanking: input.valuesRanking } : {}),
    };
    const probe = { ...s, progress: progress as unknown as Json };
    if (!stationScorable(cfg, probe, responses))
      throw new AssessmentError('station_incomplete', 'Not enough answers to score this station', {
        station: cfg.id,
        answered: cfg.id === 'context' ? 0 : countAnswered(responses, cfg.instrumentId!),
        expected: cfg.id === 'context' ? 0 : stationItems(cfg.id).expected,
      });

    const stationsDone = s.stationsDone.includes(cfg.id) ? s.stationsDone : [...s.stationsDone, cfg.id];
    const next = stationsFor(s.kind).find((x) => !stationsDone.includes(x.id))?.id ?? null;
    const updated = await repo.updateSession(s.id, {
      stationsDone,
      station: next,
      progress: progress as unknown as Json,
      lastActiveAt: iso(),
    });
    return viewOf(updated);
  }

  const publicResult = (r: ResultRecord) => ({
    id: r.id,
    sessionId: r.sessionId,
    assessmentVersion: r.assessmentVersion,
    engineVersion: r.engineVersion,
    normsVersion: r.normsVersion,
    scores: r.scores,
    matches: r.matches,
    context: r.context,
    coverage: r.coverage,
    quality: r.quality,
    summary: r.summary,
    createdAt: r.createdAt,
  });

  /**
   * Score on the server with the engine, store the result (service_role) and close the session.
   * Idempotent: a second call returns the stored result untouched. Partial sessions are scored
   * over the stations that exist; `coverage` < 1 says so.
   */
  async function finalize(userId: string, rawInput: unknown) {
    const { sessionId } = parse(sessionRefSchema, rawInput);
    const s = await loadSession(userId, sessionId);

    let result = await repo.getResult(s.id);
    if (!result) {
      assertOpen(s);
      assertPinnedVersions(s);
      const responses = await repo.listResponses(s.id);
      const progress = progressOf(s);
      const context = progress.context ?? (await repo.getUserContext(userId));
      const scored = scoreSession({
        userId,
        sessionId: s.id,
        responses,
        valuesRanking: progress.valuesRanking,
        context,
        instrumentVersions: progress.instrumentVersions,
      });
      if (!scored) throw new AssessmentError('insufficient_data', 'Not enough answers to produce a result');
      result = await repo.insertResult(scored);
    }

    if (s.status !== 'completed') {
      const scoredStations = ((result.scores.derived as Json | undefined)?.scoredStations as string[] | undefined) ?? [];
      const done = [...new Set([...s.stationsDone, ...scoredStations])];
      await repo.updateSession(s.id, {
        status: 'completed',
        stationsDone: done,
        station: null,
        completedAt: iso(),
        lastActiveAt: iso(),
      });
    }
    return publicResult(result);
  }

  async function getResult(userId: string, rawInput: unknown) {
    const { sessionId } = parse(sessionRefSchema, rawInput);
    const s = await loadSession(userId, sessionId);
    const r = await repo.getResult(s.id);
    if (!r) throw new AssessmentError('not_found', 'No result for this session yet');
    return publicResult(r);
  }

  /** The user's most recent stored result across sessions, or null. */
  async function getLatestResult(userId: string) {
    const r = await repo.getLatestResult(userId);
    return r ? publicResult(r) : null;
  }

  /**
   * What the assessment entry point should do: resume an open session, show the latest result
   * (with the retake rule), or start fresh. Never starts a session by itself.
   */
  async function getEntryState(userId: string): Promise<EntryState> {
    const open = await repo.findOpenSession(userId, 'full');
    if (open) return { kind: 'open' };
    const latest = await repo.getLatestResult(userId);
    if (!latest) return { kind: 'new' };
    return { kind: 'results', sessionId: latest.sessionId, completedAt: latest.createdAt, retake: retakeStatus(latest.createdAt, now()) };
  }

  /** Decision-readiness pre/post check. All six items are required; idempotent per (session, phase). */
  async function saveReadiness(userId: string, rawInput: unknown) {
    const input = parse(readinessSchema, rawInput);
    const inst = likert(READINESS.instrumentId);
    const { min, max } = inst.responseScale;
    const ids = new Set(inst.items.map((i) => i.id));

    const unknown = Object.keys(input.answers).filter((id) => !ids.has(id));
    if (unknown.length) throw new AssessmentError('invalid_item', 'Unknown readiness items', unknown.map((itemId) => ({ itemId, reason: 'unknown_item' })));
    const bad = Object.entries(input.answers).filter(([, v]) => !Number.isInteger(v) || v < min || v > max);
    if (bad.length) throw new AssessmentError('invalid_value', 'Readiness values out of range', bad.map(([itemId]) => ({ itemId, reason: 'value_out_of_range' })));
    const missing = [...ids].filter((id) => !(id in input.answers));
    if (missing.length) throw new AssessmentError('invalid_input', 'All readiness items must be answered', missing.map((itemId) => ({ itemId, reason: 'missing' })));

    if (input.sessionId) {
      await loadSession(userId, input.sessionId); // ownership
      // The post-reveal check is taken once per result: a repeat returns the stored answer untouched.
      if (input.phase === 'post') {
        const prior = await repo.findReadiness(userId, input.sessionId, 'post');
        if (prior) return { phase: prior.phase, sessionId: prior.sessionId, score: prior.score, takenAt: prior.takenAt };
      }
    }

    const scale = scoreLikert(
      inst,
      Object.entries(input.answers).map(([itemId, value]) => ({ itemId, value })),
    ).scales[inst.scales[0]!.id];
    const score = Math.round((scale?.normalized ?? 0) * 10000) / 100;
    const [versionId] = await repo.resolveInstrumentVersionIds([{ instrumentId: inst.id, version: inst.version }]);

    const rec: ReadinessRecord = await repo.upsertReadiness({
      userId,
      sessionId: input.sessionId ?? null,
      phase: input.phase,
      instrumentVersionId: versionId ?? null,
      answers: input.answers,
      score,
      takenAt: iso(),
    });
    return { phase: rec.phase, sessionId: rec.sessionId, score: rec.score, takenAt: rec.takenAt };
  }

  /** Whether the post-reveal readiness check was already taken for this session. */
  async function hasPostReadiness(userId: string, sessionId: string): Promise<boolean> {
    return (await repo.findReadiness(userId, sessionId, 'post')) !== null;
  }

  return { preview, hasPostReadiness, startSession, saveResponses, saveContext, getProgress, getResume, completeStation, finalize, getResult, getLatestResult, getEntryState, saveReadiness };
}

export type AssessmentService = ReturnType<typeof createAssessmentService>;
