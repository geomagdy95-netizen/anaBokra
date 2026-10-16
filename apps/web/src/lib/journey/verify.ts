import { careers, enjoyId, type PathContent, type PathTask } from '@anabokra/content';

import { ARRANGE_RING } from '@/features/world/layout';
import type { KvStore } from '@/lib/local/kv';

import type { CareerRecord } from './career-quest';
import type { GameId, GameRecord } from './games';
import type { Situation } from './situation';

/**
 * Verify (docs/product/discover-verify.md §5): answers to a path's own tasks, and the path result.
 * Kept on the phone, encrypted, under `journey:{profileId}`; deleted with the profile and moved with
 * a backup or transfer.
 *
 * Answers: story 1–3 (not for me / OK / sounds great); this-or-that 0 = a, 1 = b; scenario and
 * puzzle = option index; "did you enjoy that?" 1–3.
 */

export type VerifyBand = 'fitsWell' | 'fitsPartly' | 'rethink';

/** Draft weights and cut-offs, for the psychologist to set (discover-verify.md §8). */
export const VERIFY_WEIGHTS = { profile: 0.5, activities: 0.3, realities: 0.2 } as const;
export const VERIFY_BANDS = { fitsWell: 0.65, fitsPartly: 0.45 } as const;

export interface CareerVerify {
  careerId: string;
  /** 0–1, the same mix as the path, for this career's own items. */
  fit: number;
  /** Reality items this user turned down that apply to this career specifically. */
  cautions: string[];
}

export interface VerifyResult {
  pathId: string;
  version: string;
  /** 0–1. */
  fit: number;
  band: VerifyBand;
  components: { profile: number; activities: number; realities: number };
  /** Story items rated "sounds great", best first (at most 3). */
  enjoyed: string[];
  /** Reality items where the user picked the path's side. */
  accepted: string[];
  /** Reality items where the user picked the other side. */
  turnedDown: string[];
  careers: CareerVerify[];
  at: string;
}

export interface PathRecord {
  answers: Record<string, number>;
  result?: VerifyResult;
}

export interface JourneyDoc {
  v: 1;
  paths: Record<string, PathRecord>;
  /** Fields the user added to their map themselves (orange bridge). */
  added?: string[];
  /** Fields the user took off their map (a suggestion they don't want there). Answers stay intact. */
  hidden?: string[];
  /** User-arranged island positions in world X/Z coordinates. */
  positions?: Partial<Record<string, readonly [number, number]>>;
  /** Paths the user bookmarked (the Saved tab). */
  saved?: string[];
  /** "My results were clear and useful" (pilot plan §7), 1–5, asked once after the first path result. */
  rating?: { value: number; at: string };
  /** First full play of each Discover game (lib/journey/games.ts). */
  games?: Partial<Record<GameId, GameRecord>>;
  /** L2 career islands: each career's quest answers and result (lib/journey/career-quest.ts). */
  careers?: Record<string, CareerRecord>;
  /** The careers the user selected (at most CAREER_CAP), in the order chosen. */
  selectedCareers?: string[];
  /**
   * Optional answers about the user's circumstances (lib/journey/situation.ts). Only ever kept on the
   * device: stats and research uploads pick their own fields and never read this.
   */
  situation?: Situation;
}

export const journeyKey = (profileId: string) => `journey:${profileId}`;

export async function readJourney(kv: KvStore, profileId: string): Promise<JourneyDoc> {
  return (await kv.get<JourneyDoc>(journeyKey(profileId))) ?? { v: 1, paths: {} };
}

/** Saves one path answer (read–modify–write; the task player saves one answer at a time). */
export async function saveVerifyAnswer(kv: KvStore, profileId: string, pathId: string, itemId: string, value: number): Promise<void> {
  const doc = await readJourney(kv, profileId);
  const rec = doc.paths[pathId] ?? { answers: {} };
  doc.paths[pathId] = { ...rec, answers: { ...rec.answers, [itemId]: value } };
  await kv.set(journeyKey(profileId), doc);
}

export async function saveVerifyResult(kv: KvStore, profileId: string, result: VerifyResult): Promise<void> {
  const doc = await readJourney(kv, profileId);
  const rec = doc.paths[result.pathId] ?? { answers: {} };
  doc.paths[result.pathId] = { ...rec, result };
  await kv.set(journeyKey(profileId), doc);
}

/** Adds a path to, or removes it from, one of the user's lists on the phone; returns the new list. */
export async function setInList(kv: KvStore, profileId: string, list: 'added' | 'saved', pathId: string, on: boolean): Promise<string[]> {
  const doc = await readJourney(kv, profileId);
  const current = doc[list] ?? [];
  const next = on ? (current.includes(pathId) ? current : [...current, pathId]) : current.filter((id) => id !== pathId);
  await kv.set(journeyKey(profileId), { ...doc, [list]: next });
  return next;
}

/**
 * Puts a field on the user's map or takes it off. On: it joins "added" (unless it's already there) and
 * leaves "hidden". Off: it leaves "added" and, so a suggestion or a started path also goes, joins
 * "hidden". Answers, results and saved stay as they are, so adding it back restores it exactly.
 */
export async function setOnMap(kv: KvStore, profileId: string, pathId: string, on: boolean): Promise<void> {
  const doc = await readJourney(kv, profileId);
  const without = (list: string[] | undefined) => (list ?? []).filter((id) => id !== pathId);
  await kv.set(journeyKey(profileId), {
    ...doc,
    added: on ? [...without(doc.added), pathId] : without(doc.added),
    hidden: on ? without(doc.hidden) : [...without(doc.hidden), pathId],
  });
}

/** Persists a moved island. Positions are kept inside the archipelago and away from the core. */
export async function setIslandPosition(kv: KvStore, profileId: string, pathId: string, x: number, z: number): Promise<void> {
  const distance = Math.hypot(x, z);
  const [min, max] = ARRANGE_RING;
  const radius = Math.max(min, Math.min(max, distance || min));
  const scale = radius / (distance || 1);
  const doc = await readJourney(kv, profileId);
  await kv.set(journeyKey(profileId), {
    ...doc,
    positions: { ...doc.positions, [pathId]: [x * scale, z * scale] as const },
  });
}

export async function saveRating(kv: KvStore, profileId: string, value: number, now = new Date()): Promise<void> {
  if (!Number.isInteger(value) || value < 1 || value > 5) throw new Error('rating_out_of_range');
  const doc = await readJourney(kv, profileId);
  await kv.set(journeyKey(profileId), { ...doc, rating: { value, at: now.toISOString() } });
}

/**
 * Whether `value` is an answer this path's item allows (story and "did you enjoy that?" 1–3,
 * this-or-that 0–1, scenario and puzzle an option index). Used to check research uploads.
 */
export function pathAnswerAllowed(path: PathContent, itemId: string, value: number): boolean {
  if (!Number.isInteger(value)) return false;
  for (const task of path.tasks) {
    for (const item of task.items) {
      if (task.kind === 'story' && item.id === itemId) return value >= 1 && value <= 3;
      if (task.kind === 'thisOrThat' && item.id === itemId) return value === 0 || value === 1;
      if (task.kind === 'tryIt') {
        if (enjoyId(item.id) === itemId) return value >= 1 && value <= 3;
        if (item.id === itemId) return value >= 0 && value < (item as { options: unknown[] }).options.length;
      }
    }
  }
  return false;
}

/** The ids a task needs answered ("Try it" items each have a follow-up enjoy answer). */
export function taskItemIds(task: PathTask): string[] {
  return task.kind === 'tryIt' ? task.items.flatMap((i) => [i.id, enjoyId(i.id)]) : task.items.map((i) => i.id);
}

export const taskDone = (task: PathTask, answers: Record<string, number>) => taskItemIds(task).every((id) => answers[id] !== undefined);

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
const round3 = (x: number) => Math.round(x * 1000) / 1000;
const applies = (item: { careers?: string[] }, careerId: string) => !item.careers?.length || item.careers.includes(careerId);

export function bandFor(fit: number): VerifyBand {
  return fit >= VERIFY_BANDS.fitsWell ? 'fitsWell' : fit >= VERIFY_BANDS.fitsPartly ? 'fitsPartly' : 'rethink';
}

/**
 * Scores a verified path. `groupFit` is the path's profile fit from Discover (0–100, the average of
 * its 3 best careers); `careerFits` holds every career's fit (0–100). Pure.
 */
export function scoreVerify(
  path: PathContent,
  answers: Record<string, number>,
  { groupFit, careerFits, now = new Date() }: { groupFit: number; careerFits: Record<string, number>; now?: Date },
): VerifyResult {
  const day = path.tasks.find((t) => t.kind === 'story');
  const real = path.tasks.find((t) => t.kind === 'thisOrThat');
  const tryIt = path.tasks.find((t) => t.kind === 'tryIt');

  const dayScore = (id: string) => (answers[id] !== undefined ? (answers[id]! - 1) / 2 : undefined);
  const accepted = (item: { id: string; path: 'a' | 'b' }) => (answers[item.id] === undefined ? undefined : answers[item.id] === (item.path === 'a' ? 0 : 1));

  const dayItems = day?.kind === 'story' ? day.items : [];
  const realItems = real?.kind === 'thisOrThat' ? real.items : [];
  const tryItems = tryIt?.kind === 'tryIt' ? tryIt.items : [];

  const tryScores: number[] = [];
  for (const i of tryItems) {
    const e = answers[enjoyId(i.id)];
    if (e !== undefined) tryScores.push((e - 1) / 2);
    const a = answers[i.id];
    if (i.type === 'scenario' && a !== undefined && i.options[a]) tryScores.push(i.options[a]!.fit);
  }
  const dayMean = mean(dayItems.flatMap((i) => (dayScore(i.id) === undefined ? [] : [dayScore(i.id)!])));
  const tryMean = mean(tryScores);
  const activities = mean([dayMean, tryMean].filter((x): x is number => x !== undefined)) ?? 0.5;
  const realAnswers = realItems.flatMap((i) => (accepted(i) === undefined ? [] : [accepted(i) ? 1 : 0]));
  const realities = mean(realAnswers) ?? 0.5;
  const profile = Math.max(0, Math.min(1, groupFit / 100));

  const fit = VERIFY_WEIGHTS.profile * profile + VERIFY_WEIGHTS.activities * activities + VERIFY_WEIGHTS.realities * realities;

  const groupCareers = careers.filter((c) => c.cluster === path.id).map((c) => c.id);
  const careerResults: CareerVerify[] = groupCareers
    .map((careerId) => {
      const act = mean(dayItems.filter((i) => applies(i, careerId)).flatMap((i) => (dayScore(i.id) === undefined ? [] : [dayScore(i.id)!]))) ?? activities;
      const rel = mean(realItems.filter((i) => applies(i, careerId)).flatMap((i) => (accepted(i) === undefined ? [] : [accepted(i) ? 1 : 0]))) ?? realities;
      const p = Math.max(0, Math.min(1, (careerFits[careerId] ?? 0) / 100));
      return {
        careerId,
        fit: round3(VERIFY_WEIGHTS.profile * p + VERIFY_WEIGHTS.activities * act + VERIFY_WEIGHTS.realities * rel),
        cautions: realItems.filter((i) => i.careers?.includes(careerId) && accepted(i) === false).map((i) => i.id),
      };
    })
    .sort((a, b) => b.fit - a.fit || a.careerId.localeCompare(b.careerId));

  return {
    pathId: path.id,
    version: path.version,
    fit: round3(fit),
    band: bandFor(fit),
    components: { profile: round3(profile), activities: round3(activities), realities: round3(realities) },
    enjoyed: dayItems.filter((i) => answers[i.id] === 3).map((i) => i.id).slice(0, 3),
    accepted: realItems.filter((i) => accepted(i) === true).map((i) => i.id),
    turnedDown: realItems.filter((i) => accepted(i) === false).map((i) => i.id),
    careers: careerResults,
    at: now.toISOString(),
  };
}
