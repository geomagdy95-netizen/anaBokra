import { careerById, type Career } from '@anabokra/content';
import type { I18n } from '@anabokra/engine';

import type { CareerPage } from '@/features/careers/types';
import type { KvStore } from '@/lib/local/kv';

import { readJourney, journeyKey, VERIFY_BANDS, VERIFY_WEIGHTS, type JourneyDoc, type VerifyBand } from './verify';

/**
 * L2 career islands (docs/product/world-spec.md §1.1, §2.3): a career's island opens once its group's
 * path is checked (any band; no fail state). Its bridge is a "career quest", a short chat built from
 * the career's own page (packages/content/careers/pages), so every career has one without new writing:
 *
 * - the day in the life, with a reaction (enjoyment);
 * - its tasks as a grid, "tap the ones you'd enjoy" (enjoyment);
 * - guess the pay (knowledge only, never scored);
 * - its challenges, "could you live with this?" (realities);
 * - myth or fact (knowledge only, never scored);
 * - the route in, "does this route work for you?" (realities).
 *
 * The result mixes the Discover fit for the career with the quest the same way a path result does
 * (VERIFY_WEIGHTS, bands at VERIFY_BANDS): drafts for the psychologist. A finished quest is a reached
 * island; up to CAREER_CAP careers can be selected, which is what opens L3 later. Everything stays on
 * the phone with the journey; none of it is uploaded.
 */

export const CAREER_CAP = 2;
/** How many of a career's challenges the quest asks about. */
const CHALLENGES = 2;

/** Answers: reactions 1–3; task cards 1 tapped / 0 not; salary and myth the option index. */
export type QuestBeat =
  | { kind: 'day'; id: 'day'; text: I18n }
  | { kind: 'tasks'; id: 'tasks'; tasks: I18n[] }
  | { kind: 'salary'; id: 'salary'; options: { min: number; max: number }[]; answer: number }
  | { kind: 'challenge'; id: `challenge${number}`; text: I18n }
  | { kind: 'myth'; id: 'myth'; statement: I18n; isMyth: boolean; explain: I18n }
  | { kind: 'route'; id: 'route'; faculties: I18n[]; years: number | null };

export const taskId = (i: number) => `task${i}`;

/** Ids a beat needs answered (the task grid answers one id per task card). */
export const questBeatIds = (beat: QuestBeat): string[] => (beat.kind === 'tasks' ? beat.tasks.map((_, i) => taskId(i)) : [beat.id]);
export const questBeatDone = (beat: QuestBeat, answers: Readonly<Record<string, number>>) => questBeatIds(beat).every((id) => answers[id] !== undefined);

/** A stable small number from a string, to vary the quest per career without randomness. */
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Rounds pay to a friendly figure: 100s under 2,000, 500s under 10,000, then 1,000s (never below 100). */
const nice = (n: number) => Math.max(100, n < 2_000 ? Math.round(n / 100) * 100 : n < 10_000 ? Math.round(n / 500) * 500 : Math.round(n / 1000) * 1000);

/**
 * Four pay ranges, one of them the real one (the published band nearest a first job). The others are
 * as wide (in proportion) and sit just below or above their neighbour, so no two overlap. Where the
 * real one sits varies by career.
 */
function salaryOptions(careerId: string, real: { min: number; max: number }): { options: { min: number; max: number }[]; answer: number } {
  const answer = hash(careerId) % 3;
  const ratio = Math.max(1.3, real.max / real.min);
  const gap = 1.25;
  const options: { min: number; max: number }[] = [{ min: real.min, max: real.max }];
  while (options.length < answer + 1) {
    const max = options[0]!.min / gap;
    options.unshift({ min: max / ratio, max });
  }
  while (options.length < 4) {
    const min = options[options.length - 1]!.max * gap;
    options.push({ min, max: min * ratio });
  }
  // Friendly figures, kept apart after rounding.
  const out = options.map((o) => ({ min: nice(o.min), max: nice(o.max) }));
  for (let i = 1; i < out.length; i++) if (out[i]!.min <= out[i - 1]!.max) out[i]!.min = nice(out[i - 1]!.max * gap);
  return { options: out, answer };
}

/** The quest's beats, in order. Steps without content on the page are left out. */
export function questPlan(page: CareerPage): QuestBeat[] {
  const beats: QuestBeat[] = [];
  const day = page.snapshot?.dayInLife;
  if (day) beats.push({ kind: 'day', id: 'day', text: day });
  const tasks = page.whatYouDo?.tasks ?? [];
  if (tasks.length) beats.push({ kind: 'tasks', id: 'tasks', tasks: tasks.slice(0, 6) });
  const pay = page.marketEgypt?.salaryMonthlyEgp;
  const band = pay?.junior ?? pay?.mid ?? null;
  if (band && band.min > 0 && band.max >= band.min) beats.push({ kind: 'salary', id: 'salary', ...salaryOptions(page.id, band) });
  const challenges = (page.reality?.challenges ?? []).slice(0, CHALLENGES);
  const myths = page.reality?.myths ?? [];
  if (challenges[0]) beats.push({ kind: 'challenge', id: 'challenge0', text: challenges[0] });
  if (myths[0]) {
    // Some careers show the myth, others the fact, so "myth" isn't always the answer.
    const showFact = hash(page.id) % 2 === 1;
    const m = myths[0];
    // After the answer: for a myth, the fact; for a fact, the myth many people believe instead.
    beats.push({ kind: 'myth', id: 'myth', statement: showFact ? m.fact : m.myth, isMyth: !showFact, explain: showFact ? m.myth : m.fact });
  }
  if (challenges[1]) beats.push({ kind: 'challenge', id: 'challenge1', text: challenges[1] });
  const faculties = page.pathEgypt?.faculties ?? [];
  if (faculties.length) beats.push({ kind: 'route', id: 'route', faculties: faculties.slice(0, 2), years: page.pathEgypt?.studyYears ?? null });
  return beats;
}

export const questDone = (page: CareerPage, answers: Readonly<Record<string, number>>) => questPlan(page).every((b) => questBeatDone(b, answers));

export interface CareerResult {
  careerId: string;
  /** Version of the career page the quest was built from. */
  version: string;
  /** 0–1. */
  fit: number;
  band: VerifyBand;
  components: { profile: number; activities: number; realities: number };
  /** Task cards the user tapped (indexes into the page's tasks). */
  likedTasks: number[];
  /** Challenges the user said they could live with (1 "not for me" excluded), and the ones they couldn't. */
  okWith: number[];
  hardFor: number[];
  at: string;
}

export interface CareerRecord {
  answers: Record<string, number>;
  result?: CareerResult;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
const round3 = (x: number) => Math.round(x * 1000) / 1000;
const react = (v: number | undefined) => (v === undefined ? undefined : (v - 1) / 2);

/** Scores a finished (or partly answered) quest. `profileFit` is the career's Discover fit, 0–100. Pure. */
export function scoreQuest(page: CareerPage, answers: Readonly<Record<string, number>>, { profileFit, now = new Date() }: { profileFit: number; now?: Date }): CareerResult {
  const beats = questPlan(page);
  const tasks = beats.find((b) => b.kind === 'tasks');
  const taskShare = tasks?.kind === 'tasks' ? mean(tasks.tasks.flatMap((_, i) => (answers[taskId(i)] === undefined ? [] : [answers[taskId(i)]! ? 1 : 0]))) : undefined;
  const activities = mean([react(answers.day), taskShare].filter((x): x is number => x !== undefined)) ?? 0.5;
  const challengeIds = beats.filter((b) => b.kind === 'challenge').map((b) => b.id);
  const realities = mean([...challengeIds.map((id) => react(answers[id])), react(answers.route)].filter((x): x is number => x !== undefined)) ?? 0.5;
  const profile = Math.max(0, Math.min(1, profileFit / 100));
  const fit = VERIFY_WEIGHTS.profile * profile + VERIFY_WEIGHTS.activities * activities + VERIFY_WEIGHTS.realities * realities;
  const index = (id: string) => Number(id.replace(/\D/g, ''));
  return {
    careerId: page.id,
    version: page.version ?? '0',
    fit: round3(fit),
    band: fit >= VERIFY_BANDS.fitsWell ? 'fitsWell' : fit >= VERIFY_BANDS.fitsPartly ? 'fitsPartly' : 'rethink',
    components: { profile: round3(profile), activities: round3(activities), realities: round3(realities) },
    likedTasks: tasks?.kind === 'tasks' ? tasks.tasks.flatMap((_, i) => (answers[taskId(i)] ? [i] : [])) : [],
    okWith: challengeIds.filter((id) => (answers[id] ?? 0) >= 2).map(index),
    hardFor: challengeIds.filter((id) => answers[id] === 1).map(index),
    at: now.toISOString(),
  };
}

// --- Unlocking, progress and selection ----------------------------------------------------------

/** A career's island is open once its group's path has a result. */
export function careerUnlocked(journey: JourneyDoc, careerId: string): boolean {
  const career = careerById(careerId);
  return Boolean(career && journey.paths[career.cluster]?.result);
}

export type CareerIslandState = 'available' | 'building' | 'reached' | 'selected';

export function careerState(journey: JourneyDoc, careerId: string): CareerIslandState {
  if (journey.selectedCareers?.includes(careerId)) return 'selected';
  const rec = journey.careers?.[careerId];
  if (rec?.result) return 'reached';
  return rec && Object.keys(rec.answers).length ? 'building' : 'available';
}

/**
 * The careers shown as islets next to a checked group island: its three best careers from the path
 * result, then any of its careers the user started or selected.
 */
export function careerIslets(journey: JourneyDoc, groupId: string): string[] {
  const result = journey.paths[groupId]?.result;
  if (!result) return [];
  const mine = Object.keys(journey.careers ?? {})
    .concat(journey.selectedCareers ?? [])
    .filter((id) => careerById(id)?.cluster === groupId && careerState(journey, id) !== 'available');
  return [...new Set([...result.careers.slice(0, 3).map((c) => c.careerId), ...mine])];
}

export async function saveQuestAnswer(kv: KvStore, profileId: string, careerId: string, itemId: string, value: number): Promise<void> {
  const doc = await readJourney(kv, profileId);
  const rec = doc.careers?.[careerId] ?? { answers: {} };
  await kv.set(journeyKey(profileId), { ...doc, careers: { ...doc.careers, [careerId]: { ...rec, answers: { ...rec.answers, [itemId]: value } } } });
}

export async function saveQuestResult(kv: KvStore, profileId: string, result: CareerResult): Promise<void> {
  const doc = await readJourney(kv, profileId);
  const rec = doc.careers?.[result.careerId] ?? { answers: {} };
  await kv.set(journeyKey(profileId), { ...doc, careers: { ...doc.careers, [result.careerId]: { ...rec, result } } });
}

export class CareerCapError extends Error {
  constructor(readonly selected: string[]) {
    super('career_cap');
  }
}

/**
 * Selects a career (one of the user's careers, at most CAREER_CAP) or lets it go. Selecting needs a
 * reached island (a finished quest); at the cap it throws CareerCapError with the current selection.
 * The cap is enforced here, in the progress logic, not only in the UI (world-spec §1.3).
 */
export async function setCareerSelected(kv: KvStore, profileId: string, careerId: string, on: boolean): Promise<string[]> {
  const doc = await readJourney(kv, profileId);
  const current = doc.selectedCareers ?? [];
  let next = current.filter((id) => id !== careerId);
  if (on) {
    if (!doc.careers?.[careerId]?.result) throw new Error('career_not_reached');
    if (!current.includes(careerId) && current.length >= CAREER_CAP) throw new CareerCapError(current);
    next = current.includes(careerId) ? current : [...current, careerId];
  }
  await kv.set(journeyKey(profileId), { ...doc, selectedCareers: next });
  return next;
}

/** The careers of a group, for lists (best fit first when the path has a result). */
export function groupCareers(journey: JourneyDoc, groupId: string, all: readonly Career[]): string[] {
  const ranked = journey.paths[groupId]?.result?.careers.map((c) => c.careerId) ?? [];
  const rest = all.filter((c) => c.cluster === groupId && !ranked.includes(c.id)).map((c) => c.id);
  return [...ranked, ...rest];
}
