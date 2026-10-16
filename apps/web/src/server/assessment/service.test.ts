import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { instruments } from '@anabokra/content';
import { describe, expect, it } from 'vitest';

import { ASSESSMENT_VERSION, ENGINE_VERSION } from './config';
import { AssessmentError, type AssessmentErrorCode } from './errors';
import { allItemIdsUnique } from './items';
import { MemoryAssessmentRepo } from './memory-repo';
import { createAssessmentService } from './service';

const ADULT = 'a0000000-0000-4000-8000-000000000001';
const MINOR = 'a0000000-0000-4000-8000-000000000002';
const PARENT = 'a0000000-0000-4000-8000-000000000003';
const OTHER = 'a0000000-0000-4000-8000-000000000004';

function setup() {
  let t = Date.parse('2026-10-09T10:00:00Z');
  const now = () => new Date((t += 1000));
  const repo = new MemoryAssessmentRepo({ now });
  repo.addUser(ADULT);
  repo.addUser(MINOR, { needsConsent: true });
  repo.addUser(PARENT, { role: 'parent' });
  repo.addUser(OTHER);
  return { repo, svc: createAssessmentService({ repo, now }) };
}

async function code(p: Promise<unknown>): Promise<AssessmentErrorCode | 'no_error'> {
  try {
    await p;
    return 'no_error';
  } catch (e) {
    if (e instanceof AssessmentError) return e.code;
    throw e;
  }
}

// --- deterministic "scientist" answer set (same shape as packages/content/scripts/demo.ts) -------
const likes: Record<string, number> = { R: 2, I: 5, A: 3, S: 2, E: 1, C: 3 };
const traits: Record<string, number> = { extraversion: 2, agreeableness: 3, conscientiousness: 4, emotionalStability: 4, intellect: 5 };
const mustValues = ['achievement', 'independence'];
const strengths: Record<string, number> = { verbal: 4, numerical: 5, logical: 5, spatial: 4, creative: 3, manual: 2 };

// Vary answers a little so the straight-lining check has nothing to flag.
const wobble = (i: number) => (i % 7 === 0 ? 1 : i % 5 === 0 ? -1 : 0);
const clamp = (v: number) => Math.min(5, Math.max(1, v));

const interestAnswers = () =>
  instruments.interests.items.map((it, i) => ({
    itemId: it.id,
    value: it.attentionCheck ? it.attentionCheck.expected : clamp(likes[it.scale!]! + wobble(i)),
    ms: 2500,
  }));
const personalityAnswers = () =>
  instruments.personality.items.map((it, i) => {
    if (it.attentionCheck) return { itemId: it.id, value: it.attentionCheck.expected, ms: 3000 };
    const level = traits[it.scale!]!;
    return { itemId: it.id, value: clamp((it.keyed === -1 ? 6 - level : level) + wobble(i)), ms: 3000 };
  });
const valueAnswers = () =>
  instruments.values.cards.map((c) => ({
    itemId: c.id,
    value: mustValues.includes(c.value) ? 3 : c.value === 'support' ? 1 : 2,
    ms: 1800,
  }));
const abilityAnswers = () =>
  instruments.abilities.selfRatings.map((s) => ({ itemId: s.id, value: strengths[s.domain]!, ms: 2000 }));

async function startFull(svc: ReturnType<typeof setup>['svc'], userId = ADULT) {
  const { session } = await svc.startSession(userId, {});
  return session.id;
}

async function answerAll(svc: ReturnType<typeof setup>['svc'], userId: string, sessionId: string) {
  const stations = [
    ['interests', interestAnswers()],
    ['personality', personalityAnswers()],
    ['values', valueAnswers()],
    ['abilities', abilityAnswers()],
  ] as const;
  for (const [station, responses] of stations) {
    await svc.saveResponses(userId, { sessionId, station, responses });
    await svc.completeStation(userId, { sessionId, station });
  }
}

describe('catalog', () => {
  it('has globally unique item ids (responses is unique on session + item id)', () => {
    expect(allItemIdsUnique()).toBe(true);
  });
  it('engine version constant matches packages/engine/package.json', () => {
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../../packages/engine/package.json', import.meta.url)), 'utf8'));
    expect(ENGINE_VERSION).toBe(pkg.version);
  });
});

describe('start / resume', () => {
  it('creates a session pinned to the current instrument versions, starting at interests', async () => {
    const { svc, repo } = setup();
    const r = await svc.startSession(ADULT, { locale: 'en' });
    expect(r.resumed).toBe(false);
    expect(r.progress.currentStation).toBe('interests');
    expect(r.progress.stations.map((s) => s.id)).toEqual(['interests', 'personality', 'values', 'abilities', 'context']);
    expect(r.progress.stations[0]).toMatchObject({ answered: 0, expected: 61, version: instruments.interests.version });
    const stored = await repo.getSession(ADULT, r.session.id);
    expect(stored?.progress).toMatchObject({ assessmentVersion: ASSESSMENT_VERSION });
    expect(stored?.instrumentVersionIds).toHaveLength(4);
  });

  it('returns the open session instead of creating another, with saved answers and cursor', async () => {
    const { svc } = setup();
    const first = await svc.startSession(ADULT, {});
    const answers = interestAnswers().slice(0, 10);
    await svc.saveResponses(ADULT, { sessionId: first.session.id, station: 'interests', responses: answers, cursor: { index: 10 } });

    const again = await svc.startSession(ADULT, {});
    expect(again.resumed).toBe(true);
    expect(again.session.id).toBe(first.session.id);
    expect(again.progress.stations[0]).toMatchObject({ answered: 10, expected: 61, done: false });
    expect(again.progress.currentStation).toBe('interests');
    expect(again.progress.cursor).toEqual({ index: 10 });
  });

  it('moves the current station forward when a station is completed, and resumes there', async () => {
    const { svc } = setup();
    const id = await startFull(svc);
    await svc.saveResponses(ADULT, { sessionId: id, station: 'interests', responses: interestAnswers() });
    const p = await svc.completeStation(ADULT, { sessionId: id, station: 'interests' });
    expect(p.currentStation).toBe('personality');
    expect((await svc.startSession(ADULT, {})).progress.currentStation).toBe('personality');
  });

  it('resumes a paused session once consent is back, not before', async () => {
    const { svc, repo } = setup();
    repo.grantConsent(MINOR);
    const id = await startFull(svc, MINOR);
    repo.withdrawConsent(MINOR);
    expect(await code(svc.startSession(MINOR, {}))).toBe('consent_required');
    repo.grantConsent(MINOR);
    const r = await svc.startSession(MINOR, {});
    expect(r.resumed).toBe(true);
    expect(r.session.id).toBe(id);
    expect(r.progress.status).toBe('in_progress');
  });

  it("hides other users' sessions", async () => {
    const { svc } = setup();
    const id = await startFull(svc);
    expect(await code(svc.getProgress(OTHER, { sessionId: id }))).toBe('not_found');
    expect(await code(svc.saveResponses(OTHER, { sessionId: id, station: 'interests', responses: interestAnswers().slice(0, 1) }))).toBe('not_found');
    expect(await code(svc.finalize(OTHER, { sessionId: id }))).toBe('not_found');
  });
});

describe('consent gate', () => {
  it('blocks a minor without consent from starting a full assessment', async () => {
    const { svc, repo } = setup();
    expect(await code(svc.startSession(MINOR, { kind: 'full' }))).toBe('consent_required');
    repo.grantConsent(MINOR);
    expect(await code(svc.startSession(MINOR, { kind: 'full' }))).toBe('no_error');
  });

  it('lets a minor take the consent-free quick taster (interests only)', async () => {
    const { svc } = setup();
    const r = await svc.startSession(MINOR, { kind: 'quick' });
    expect(r.progress.stations.map((s) => s.id)).toEqual(['interests']);
    await svc.saveResponses(MINOR, { sessionId: r.session.id, station: 'interests', responses: interestAnswers() });
    expect(await code(svc.saveResponses(MINOR, { sessionId: r.session.id, station: 'personality', responses: personalityAnswers().slice(0, 1) }))).toBe('invalid_station');
    const res = await svc.finalize(MINOR, { sessionId: r.session.id });
    expect(res.summary).toMatchObject({ partial: true });
  });

  it('stops answers when consent is withdrawn mid-session', async () => {
    const { svc, repo } = setup();
    repo.grantConsent(MINOR);
    const id = await startFull(svc, MINOR);
    await svc.saveResponses(MINOR, { sessionId: id, station: 'interests', responses: interestAnswers().slice(0, 5) });
    repo.withdrawConsent(MINOR);
    expect(await code(svc.saveResponses(MINOR, { sessionId: id, station: 'interests', responses: interestAnswers().slice(5, 8) }))).toBe('session_paused');
  });

  it('maps a database-level gate rejection on write to consent_required', async () => {
    const { svc, repo } = setup();
    repo.grantConsent(MINOR);
    const id = await startFull(svc, MINOR);
    // consent withdrawn without the session being paused (race): the RLS check still rejects the write
    (repo as unknown as { people: Map<string, { consent: boolean }> }).people.get(MINOR)!.consent = false;
    expect(await code(svc.saveResponses(MINOR, { sessionId: id, station: 'interests', responses: interestAnswers().slice(0, 1) }))).toBe('consent_required');
  });

  it('rejects non-student accounts', async () => {
    const { svc } = setup();
    expect(await code(svc.startSession(PARENT, {}))).toBe('not_student');
  });
});

describe('saveResponses', () => {
  it('is idempotent: replaying a batch changes nothing; a changed value overwrites', async () => {
    const { svc, repo } = setup();
    const id = await startFull(svc);
    const batch = interestAnswers().slice(0, 20);
    const a = await svc.saveResponses(ADULT, { sessionId: id, station: 'interests', responses: batch });
    const snapshot = JSON.stringify(repo.allResponses(id));
    const b = await svc.saveResponses(ADULT, { sessionId: id, station: 'interests', responses: batch });
    expect(a.saved).toBe(20);
    expect(b.station.answered).toBe(20);
    expect(JSON.stringify(repo.allResponses(id))).toBe(snapshot);

    await svc.saveResponses(ADULT, { sessionId: id, station: 'interests', responses: [{ itemId: batch[0]!.itemId, value: 1, ms: 900 }] });
    const rows = repo.allResponses(id);
    expect(rows).toHaveLength(20);
    expect(rows.find((r) => r.itemId === batch[0]!.itemId)).toMatchObject({ value: 1, ms: 900 });
  });

  it('keeps the last value for an id repeated inside one batch', async () => {
    const { svc, repo } = setup();
    const id = await startFull(svc);
    await svc.saveResponses(ADULT, {
      sessionId: id,
      station: 'interests',
      responses: [
        { itemId: 'ip_R01', value: 2 },
        { itemId: 'ip_R01', value: 4 },
      ],
    });
    expect(repo.allResponses(id)).toEqual([expect.objectContaining({ itemId: 'ip_R01', value: 4, ms: null })]);
  });

  it.each([
    ['unknown item id', { itemId: 'nope_01', value: 3 }, 'invalid_item'],
    ['item of another station', { itemId: 'v_accomplishment', value: 3 }, 'invalid_item'],
    ['value above range', { itemId: 'ip_R01', value: 6 }, 'invalid_value'],
    ['value below range', { itemId: 'ip_R01', value: 0 }, 'invalid_value'],
    ['fractional value', { itemId: 'ip_R01', value: 2.5 }, 'invalid_value'],
  ] as const)('rejects %s and saves nothing from the batch', async (_name, bad, expected) => {
    const { svc, repo } = setup();
    const id = await startFull(svc);
    const good = { itemId: 'ip_R02', value: 3 };
    expect(await code(svc.saveResponses(ADULT, { sessionId: id, station: 'interests', responses: [good, bad] }))).toBe(expected);
    expect(repo.allResponses(id)).toHaveLength(0);
  });

  it.each([
    ['non-numeric value', { itemId: 'ip_R01', value: '3' }],
    ['NaN-like value', { itemId: 'ip_R01', value: null }],
    ['negative time', { itemId: 'ip_R01', value: 3, ms: -5 }],
    ['absurd time', { itemId: 'ip_R01', value: 3, ms: 99_999_999 }],
    ['extra field', { itemId: 'ip_R01', value: 3, userId: 'x' }],
  ])('rejects malformed input: %s', async (_name, bad) => {
    const { svc } = setup();
    const id = await startFull(svc);
    expect(await code(svc.saveResponses(ADULT, { sessionId: id, station: 'interests', responses: [bad] }))).toBe('invalid_input');
  });

  it('rejects empty batches, oversized batches, bad session ids and unknown stations', async () => {
    const { svc } = setup();
    const id = await startFull(svc);
    const one = [{ itemId: 'ip_R01', value: 3 }];
    expect(await code(svc.saveResponses(ADULT, { sessionId: id, station: 'interests', responses: [] }))).toBe('invalid_input');
    expect(
      await code(svc.saveResponses(ADULT, { sessionId: id, station: 'interests', responses: Array.from({ length: 201 }, () => one[0]) })),
    ).toBe('invalid_input');
    expect(await code(svc.saveResponses(ADULT, { sessionId: 'not-a-uuid', station: 'interests', responses: one }))).toBe('invalid_input');
    expect(await code(svc.saveResponses(ADULT, { sessionId: id, station: 'astrology', responses: one }))).toBe('invalid_station');
    expect(await code(svc.saveResponses(ADULT, { sessionId: id, station: 'context', responses: one }))).toBe('invalid_station');
  });

  it('only accepts card-sort bucket weights and caps "must have" at the limit', async () => {
    const { svc, repo } = setup();
    const id = await startFull(svc);
    const cards = instruments.values.cards;
    expect(await code(svc.saveResponses(ADULT, { sessionId: id, station: 'values', responses: [{ itemId: cards[0]!.id, value: 4 }] }))).toBe('invalid_value');
    const eight = cards.slice(0, 8).map((c) => ({ itemId: c.id, value: 3 }));
    expect(await code(svc.saveResponses(ADULT, { sessionId: id, station: 'values', responses: eight }))).toBe('values_limit_exceeded');
    expect(repo.allResponses(id)).toHaveLength(0);
    // The cap counts previously saved cards too.
    await svc.saveResponses(ADULT, { sessionId: id, station: 'values', responses: cards.slice(0, 7).map((c) => ({ itemId: c.id, value: 3 })) });
    expect(await code(svc.saveResponses(ADULT, { sessionId: id, station: 'values', responses: [{ itemId: cards[7]!.id, value: 3 }] }))).toBe('values_limit_exceeded');
    expect(await code(svc.saveResponses(ADULT, { sessionId: id, station: 'values', responses: [{ itemId: cards[0]!.id, value: 2 }] }))).toBe('no_error');
  });

  it('rejects writes to a completed session', async () => {
    const { svc } = setup();
    const id = await startFull(svc);
    await svc.saveResponses(ADULT, { sessionId: id, station: 'interests', responses: interestAnswers() });
    await svc.finalize(ADULT, { sessionId: id });
    expect(await code(svc.saveResponses(ADULT, { sessionId: id, station: 'interests', responses: [{ itemId: 'ip_R01', value: 1 }] }))).toBe('session_closed');
  });

  it('refuses a session pinned to an instrument version that is no longer served', async () => {
    const { svc, repo } = setup();
    const id = await startFull(svc);
    const s = (await repo.getSession(ADULT, id))!;
    await repo.updateSession(id, {
      lastActiveAt: new Date().toISOString(),
      progress: { ...s.progress, instrumentVersions: { ...(s.progress.instrumentVersions as object), interests: '0.9.0' } },
    });
    expect(await code(svc.saveResponses(ADULT, { sessionId: id, station: 'interests', responses: [{ itemId: 'ip_R01', value: 3 }] }))).toBe('instrument_version_mismatch');
  });
});

describe('progress and stations', () => {
  it('reports answered/expected per station and overall', async () => {
    const { svc } = setup();
    const id = await startFull(svc);
    await svc.saveResponses(ADULT, { sessionId: id, station: 'values', responses: valueAnswers().slice(0, 5) });
    const p = await svc.getProgress(ADULT, { sessionId: id });
    expect(p.stations.find((s) => s.id === 'values')).toMatchObject({ answered: 5, expected: 21, done: false });
    expect(p.overall).toEqual({ answered: 5, expected: 61 + 51 + 21 + 12 });
    expect(p.canFinalize).toBe(false);
    expect(p.currentStation).toBe('interests');
  });

  it('completeStation needs enough answers, and is idempotent', async () => {
    const { svc } = setup();
    const id = await startFull(svc);
    await svc.saveResponses(ADULT, { sessionId: id, station: 'interests', responses: interestAnswers().slice(0, 20) });
    expect(await code(svc.completeStation(ADULT, { sessionId: id, station: 'interests' }))).toBe('station_incomplete');
    await svc.saveResponses(ADULT, { sessionId: id, station: 'interests', responses: interestAnswers() });
    const a = await svc.completeStation(ADULT, { sessionId: id, station: 'interests' });
    const b = await svc.completeStation(ADULT, { sessionId: id, station: 'interests' });
    expect(a.stations[0]!.done && b.stations[0]!.done).toBe(true);
    expect(b.currentStation).toBe('personality');
  });

  it('stores the context snapshot and mirrors it to the profile', async () => {
    const { svc, repo } = setup();
    const id = await startFull(svc);
    await svc.saveContext(ADULT, { sessionId: id, context: { stage: 'school', curriculum: 'thanaweya', track: 'science', expectedScorePct: 92 } });
    const p = await svc.saveContext(ADULT, { sessionId: id, context: { budget: 'low', track: null } });
    expect(p.progress.stations.find((s) => s.id === 'context')).toMatchObject({ answered: 4, expected: 5 });
    expect(await repo.getUserContext(ADULT)).toEqual({ stage: 'school', curriculum: 'thanaweya', expectedScorePct: 92, budget: 'low' });
    expect(await code(svc.saveContext(ADULT, { sessionId: id, context: { budget: 'rich' } }))).toBe('invalid_input');
    expect(await code(svc.saveContext(ADULT, { sessionId: id, context: {} }))).toBe('invalid_input');
  });

  it('asks field and year at university, and counts only that stage’s questions', async () => {
    const { svc } = setup();
    const id = await startFull(svc);
    const p = await svc.saveContext(ADULT, { sessionId: id, context: { stage: 'university', field: 'law', year: 3 } });
    expect(p.progress.stations.find((s) => s.id === 'context')).toMatchObject({ answered: 3, expected: 4 });
    expect(await code(svc.saveContext(ADULT, { sessionId: id, context: { field: 'astrology' } }))).toBe('invalid_input');
    expect(await code(svc.saveContext(ADULT, { sessionId: id, context: { year: 9 } }))).toBe('invalid_input');
  });
});

describe('finalize', () => {
  it('produces a stable, fully-covered result for a fixed answer set', async () => {
    const { svc } = setup();
    const id = await startFull(svc);
    await answerAll(svc, ADULT, id);
    await svc.saveContext(ADULT, { sessionId: id, context: { curriculum: 'thanaweya', track: 'science', expectedScorePct: 90, budget: 'medium' } });
    await svc.completeStation(ADULT, { sessionId: id, station: 'values', valuesRanking: ['independence', 'achievement'] });
    const result = await svc.finalize(ADULT, { sessionId: id });

    expect(result).toMatchObject({
      assessmentVersion: ASSESSMENT_VERSION,
      engineVersion: ENGINE_VERSION,
      normsVersion: null,
      coverage: 1,
      context: { curriculum: 'thanaweya', track: 'science', expectedScorePct: 90, budget: 'medium' },
    });
    const m = result.matches as { careerId: string; kind: string; rank: number }[];
    expect(m.filter((x) => x.kind === 'top')).toHaveLength(20);
    expect(m.filter((x) => x.kind === 'surprising').length).toBeLessThanOrEqual(3);
    expect(m.slice(0, 5).map((x) => x.rank)).toEqual([1, 2, 3, 4, 5]);

    const scores = result.scores as Record<string, Record<string, unknown>>;
    expect(Object.keys(scores).sort()).toEqual(['abilities', 'derived', 'interests', 'personality', 'values']);
    expect(scores.derived).toMatchObject({
      hollandCode: 'IAC',
      valuesRanking: expect.any(Array),
      abilityBasis: expect.objectContaining({ verbal: 'self' }),
      instrumentVersions: expect.objectContaining({ interests: instruments.interests.version }),
    });
    expect((scores.derived!.valuesRanking as string[]).slice(0, 2)).toEqual(['independence', 'achievement']);
    expect(result.quality).toMatchObject({ flags: [] });

    // SNAPSHOT: top 5 career ids for this answer set. A change here means scoring or content changed:
    // bump ASSESSMENT_VERSION deliberately and update the list.
    expect(m.slice(0, 5).map((x) => x.careerId)).toMatchInlineSnapshot(`
      [
        "egyptologist",
        "ai_engineer",
        "data_scientist",
        "physicist",
        "epidemiologist",
      ]
    `);
  });

  it('is idempotent: second call returns the same stored result, written once', async () => {
    const { svc, repo } = setup();
    const id = await startFull(svc);
    await answerAll(svc, ADULT, id);
    const a = await svc.finalize(ADULT, { sessionId: id });
    const b = await svc.finalize(ADULT, { sessionId: id });
    const [c, d] = await Promise.all([svc.finalize(ADULT, { sessionId: id }), svc.finalize(ADULT, { sessionId: id })]);
    expect(b).toEqual(a);
    expect(c.id).toBe(a.id);
    expect(d.id).toBe(a.id);
    expect(repo.resultInserts).toBe(1);
    const p = await svc.getProgress(ADULT, { sessionId: id });
    expect(p).toMatchObject({ status: 'completed', currentStation: null, hasResult: true });
    expect((await svc.getResult(ADULT, { sessionId: id })).id).toBe(a.id);
    // A finished student can start a fresh session afterwards.
    expect((await svc.startSession(ADULT, {})).resumed).toBe(false);
  });

  it('scores partial sessions over the stations present, with coverage < 1', async () => {
    const { svc } = setup();
    const id = await startFull(svc);
    await svc.saveResponses(ADULT, { sessionId: id, station: 'interests', responses: interestAnswers() });
    await svc.saveResponses(ADULT, { sessionId: id, station: 'abilities', responses: abilityAnswers() });
    const result = await svc.finalize(ADULT, { sessionId: id });
    expect(result.coverage).toBeCloseTo(0.65, 5); // interests .45 + abilities .20 of total weight
    expect(result.coverage).toBeLessThan(1);
    expect(result.summary).toMatchObject({ partial: true, hollandCode: 'IAC' });
    const scores = result.scores as Record<string, unknown>;
    expect(scores.personality).toBeUndefined();
    expect(scores.values).toBeUndefined();
    expect((scores.derived as { scoredStations: string[] }).scoredStations).toEqual(['interests', 'abilities']);
  });

  it('does not score a scale answered below the 80% rule (personality half done => not scored)', async () => {
    const { svc } = setup();
    const id = await startFull(svc);
    await svc.saveResponses(ADULT, { sessionId: id, station: 'interests', responses: interestAnswers() });
    await svc.saveResponses(ADULT, { sessionId: id, station: 'personality', responses: personalityAnswers().slice(0, 25) });
    const result = await svc.finalize(ADULT, { sessionId: id });
    expect((result.scores as Record<string, unknown>).personality).toBeUndefined();
    expect(result.coverage).toBeLessThan(1);
  });

  it('refuses to finalize an empty session and never stores a result', async () => {
    const { svc, repo } = setup();
    const id = await startFull(svc);
    expect(await code(svc.finalize(ADULT, { sessionId: id }))).toBe('insufficient_data');
    expect(repo.resultInserts).toBe(0);
    expect(await code(svc.getResult(ADULT, { sessionId: id }))).toBe('not_found');
  });

  it('flags rushed straight-lining without blocking the result', async () => {
    const { svc, repo } = setup();
    const id = await startFull(svc);
    // A session on the 1–5 scale (sessions from before the checklist).
    const s = (await repo.getSession(ADULT, id))!;
    await repo.updateSession(id, { progress: { ...(s.progress as object), formats: { interests: 'scale', values: 'cards' } }, lastActiveAt: s.lastActiveAt });
    const lazy = instruments.interests.items.map((it) => ({ itemId: it.id, value: it.attentionCheck ? 1 : 3, ms: 200 }));
    await svc.saveResponses(ADULT, { sessionId: id, station: 'interests', responses: lazy });
    const result = await svc.finalize(ADULT, { sessionId: id });
    expect((result.quality as { flags: string[] }).flags).toEqual(
      expect.arrayContaining(['straightLining', 'tooFast', 'attentionFailed']),
    );
  });

  it('on the checklist, flags tapping everything (low variance) but not long runs of untapped cards', async () => {
    const { svc } = setup();
    const lazyId = await startFull(svc);
    const all = instruments.interests.items.map((it) => ({ itemId: it.id, value: it.attentionCheck ? 1 : 5, ms: 200 }));
    await svc.saveResponses(ADULT, { sessionId: lazyId, station: 'interests', responses: all });
    const lazy = await svc.finalize(ADULT, { sessionId: lazyId });
    expect((lazy.quality as { flags: string[] }).flags).toEqual(expect.arrayContaining(['lowVariance', 'tooFast', 'attentionFailed']));
    expect((lazy.scores as { derived: { answerFormats?: unknown } }).derived.answerFormats).toEqual({ interests: 'checklist', values: 'budget' });

    const { svc: svc2 } = setup();
    const id = await startFull(svc2);
    // Likes only investigating and creating: long runs of untapped cards elsewhere.
    const picky = instruments.interests.items.map((it) => ({ itemId: it.id, value: it.attentionCheck || it.scale === 'I' || it.scale === 'A' ? 5 : 1, ms: 3000 }));
    await svc2.saveResponses(ADULT, { sessionId: id, station: 'interests', responses: picky });
    const r = await svc2.finalize(ADULT, { sessionId: id });
    expect((r.quality as { flags: string[] }).flags).toEqual([]);
  });
});

describe('values budget', () => {
  const coins = { vb_achievement: 3, vb_workingConditions: 2, vb_recognition: 0, vb_relationships: 4, vb_support: 0, vb_independence: 1 };
  const rows = (c: Record<string, number>) => Object.entries(c).map(([itemId, value]) => ({ itemId, value }));

  it('records the formats on a new session and scores values from the budget', async () => {
    const { svc } = setup();
    const id = await startFull(svc);
    expect((await svc.getResume(ADULT, { sessionId: id })).formats).toEqual({ interests: 'checklist', values: 'budget' });
    await svc.saveResponses(ADULT, { sessionId: id, station: 'values', responses: rows(coins) });
    const done = await svc.completeStation(ADULT, { sessionId: id, station: 'values', valuesRanking: ['relationships', 'achievement', 'workingConditions'] });
    expect(done.stations.find((st) => st.id === 'values')?.done).toBe(true);
  });

  it('rejects spending more than the coins, even across batches', async () => {
    const { svc } = setup();
    const id = await startFull(svc);
    await svc.saveResponses(ADULT, { sessionId: id, station: 'values', responses: rows({ vb_achievement: 8 }) });
    await expect(svc.saveResponses(ADULT, { sessionId: id, station: 'values', responses: rows({ vb_support: 3 }) })).rejects.toMatchObject({ code: 'invalid_value' });
    await expect(svc.saveResponses(ADULT, { sessionId: id, station: 'values', responses: rows({ vb_support: 11 }) })).rejects.toMatchObject({ code: 'invalid_value' });
  });

  it('reports sessions from before formats were recorded as the original formats', async () => {
    const { svc, repo } = setup();
    const id = await startFull(svc);
    const s = (await repo.getSession(ADULT, id))!;
    const old = { ...(s.progress as Record<string, unknown>) };
    delete old.formats;
    await repo.updateSession(id, { progress: old as never, lastActiveAt: s.lastActiveAt });
    expect((await svc.getResume(ADULT, { sessionId: id })).formats).toEqual({ interests: 'scale', values: 'cards' });
  });
});

describe('readiness', () => {
  // v = how ready the answers say the student is (reverse-keyed items are flipped).
  const answers = (v: number) => Object.fromEntries(instruments.readiness.items.map((i) => [i.id, i.keyed === -1 ? 6 - v : v]));

  it('saves pre and post, idempotently, and scores 0..100', async () => {
    const { svc, repo } = setup();
    const id = await startFull(svc);
    const pre = await svc.saveReadiness(ADULT, { phase: 'pre', sessionId: id, answers: answers(2) });
    await svc.saveReadiness(ADULT, { phase: 'pre', sessionId: id, answers: answers(2) });
    const post = await svc.saveReadiness(ADULT, { phase: 'post', sessionId: id, answers: answers(5) });
    expect(pre.score).toBe(25);
    expect(post.score).toBe(100);
    expect(repo.allReadiness()).toHaveLength(2);
    await svc.saveReadiness(ADULT, { phase: 'pre', sessionId: id, answers: answers(4) });
    expect(repo.allReadiness().find((r) => r.phase === 'pre')?.score).toBe(75);
  });

  it('takes the post check once per result: a repeat returns the stored answer untouched', async () => {
    const { svc, repo } = setup();
    const id = await startFull(svc);
    expect(await svc.hasPostReadiness(ADULT, id)).toBe(false);
    const first = await svc.saveReadiness(ADULT, { phase: 'post', sessionId: id, answers: answers(5) });
    expect(await svc.hasPostReadiness(ADULT, id)).toBe(true);
    const again = await svc.saveReadiness(ADULT, { phase: 'post', sessionId: id, answers: answers(1) });
    expect(again.score).toBe(first.score);
    expect(again.takenAt).toBe(first.takenAt);
    expect(repo.allReadiness().filter((r) => r.phase === 'post')).toHaveLength(1);
  });

  it('allows a pre check before any session exists (one row per user)', async () => {
    const { svc, repo } = setup();
    await svc.saveReadiness(ADULT, { phase: 'pre', answers: answers(3) });
    await svc.saveReadiness(ADULT, { phase: 'pre', answers: answers(4) });
    expect(repo.allReadiness()).toHaveLength(1);
  });

  it('rejects incomplete, unknown, out-of-range and foreign-session payloads', async () => {
    const { svc } = setup();
    const id = await startFull(svc);
    const ok = answers(3);
    const partial = Object.fromEntries(Object.entries(ok).filter(([k]) => k !== 'rd_01'));
    expect(await code(svc.saveReadiness(ADULT, { phase: 'pre', answers: partial }))).toBe('invalid_input');
    expect(await code(svc.saveReadiness(ADULT, { phase: 'pre', answers: { ...ok, rd_99: 3 } }))).toBe('invalid_item');
    expect(await code(svc.saveReadiness(ADULT, { phase: 'pre', answers: { ...ok, rd_01: 7 } }))).toBe('invalid_value');
    expect(await code(svc.saveReadiness(ADULT, { phase: 'mid', answers: ok }))).toBe('invalid_input');
    expect(await code(svc.saveReadiness(OTHER, { phase: 'pre', sessionId: id, answers: ok }))).toBe('not_found');
  });
});
