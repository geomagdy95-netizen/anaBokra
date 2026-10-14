import { instruments, personalityShort } from '@anabokra/content';
import { BIG_FIVE, RIASEC, type I18n } from '@anabokra/engine';

import { DISCOVER_GAMES, gameStepId, type GameId } from './games';

/**
 * Discover (docs/product/discover-verify.md §4): the general questions on the user's own island, in
 * 10 short tasks. The questions are the validated ones, unchanged; only their presentation varies:
 * interests as swipe cards, personality with faces, strengths on a slider.
 *
 * Every task carries one interest card of each type, so the interest picture fills in evenly and can
 * be scored (80% of each type) after task 8. Personality is the 20-item short set, 2 per task;
 * strengths are spread 1–2 per task; the interest attention check sits in task 5.
 */

export type DiscoverFormat = 'swipe' | 'faces' | 'slider';
export type DiscoverInstrument = 'interests' | 'personality' | 'abilities';

export interface DiscoverItem {
  id: string;
  instrumentId: DiscoverInstrument;
  format: DiscoverFormat;
  text: I18n;
}

export interface DiscoverTask {
  /** 1-based task number. */
  n: number;
  items: DiscoverItem[];
  /** A game played after the questions (docs/product/games.md); the task is done once it's played. */
  game?: GameId;
}

export const DISCOVER_TASKS = 10;
/** Strengths per task (12 in all). */
const STRENGTHS_PER_TASK = [2, 1, 1, 1, 1, 1, 1, 1, 1, 2];
/** Task (0-based) that holds the attention check. */
const CHECK_TASK = 4;

let cache: DiscoverTask[] | null = null;

export function discoverPlan(): DiscoverTask[] {
  if (cache) return cache;
  const interests = instruments.interests.items;
  const byType = RIASEC.map((t) => interests.filter((i) => i.scale === t && !i.attentionCheck));
  const check = interests.find((i) => i.attentionCheck);

  const short = personalityShort().items;
  const traitLists = BIG_FIVE.map((t) => short.filter((i) => i.scale === t));
  // Interleave traits (E, A, C, N, O, E, A, …) so two neighbours are never the same trait.
  const personality = traitLists[0]!.flatMap((_, k) => traitLists.map((l) => l[k]!)).filter(Boolean);

  const strengths = instruments.abilities.selfRatings;
  let s = 0;

  const tasks: DiscoverTask[] = [];
  for (let k = 0; k < DISCOVER_TASKS; k++) {
    // Rotate the type order per task so the same type doesn't always come first.
    const swipes: DiscoverItem[] = RIASEC.map((_, j) => byType[(j + k) % 6]![k]!).map((i) => ({
      id: i.id,
      instrumentId: 'interests',
      format: 'swipe',
      text: i.text,
    }));
    const faces: DiscoverItem[] = personality.slice(k * 2, k * 2 + 2).map((i) => ({ id: i.id, instrumentId: 'personality', format: 'faces', text: i.text }));
    const sliders: DiscoverItem[] = strengths
      .slice(s, (s += STRENGTHS_PER_TASK[k]!))
      .map((i) => ({ id: i.id, instrumentId: 'abilities', format: 'slider', text: i.text }));

    // Mix the formats: swipe, swipe, face, swipe, slider, swipe, swipe, face, swipe, (slider).
    const items: DiscoverItem[] = [swipes[0]!, swipes[1]!, faces[0]!, swipes[2]!, sliders[0]!, swipes[3]!, swipes[4]!, faces[1]!, swipes[5]!];
    if (sliders[1]) items.push(sliders[1]);
    if (k === CHECK_TASK && check) items.splice(5, 0, { id: check.id, instrumentId: 'interests', format: 'swipe', text: check.text });
    const game = DISCOVER_GAMES[k + 1];
    tasks.push({ n: k + 1, items: items.filter(Boolean), ...(game ? { game } : {}) });
  }
  cache = tasks;
  return tasks;
}

/**
 * Which tasks are done, given the ids answered so far (questions, and `game_<id>` for games played).
 * Games count while the assessment is open; once a result exists they are optional extras, so a
 * Discover finished before the games existed doesn't go backwards.
 */
export function discoverStatus(answered: ReadonlySet<string>, { gamesRequired = true }: { gamesRequired?: boolean } = {}) {
  const plan = discoverPlan();
  const done = plan.map((t) => t.items.every((i) => answered.has(i.id)) && (!gamesRequired || !t.game || answered.has(gameStepId(t.game))));
  const next = done.findIndex((d) => !d);
  return { done, doneCount: done.filter(Boolean).length, next: next === -1 ? null : next + 1 };
}
