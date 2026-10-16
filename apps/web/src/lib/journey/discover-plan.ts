import { instruments, personalityShort } from '@anabokra/content';
import { BIG_FIVE, RIASEC, type I18n } from '@anabokra/engine';

import { DISCOVER_GAMES, gameStepId, type GameId } from './games';

/**
 * Discover (docs/product/discover-verify.md §4): the general questions on the user's own island, in
 * 10 short tasks. The questions are the validated ones, unchanged; only their presentation varies
 * (steps.ts): interests as a grid of cards to tap (or swipe cards on the 1–5 scale), personality with
 * faces, strengths on a slider.
 *
 * Every task carries one interest card of each type, so the interest picture fills in evenly and can
 * be scored (80% of each type) after task 8. Personality (the 20-item short set) and the 12 strengths
 * all sit in tasks 1–8, so tasks 9 and 10 hold only interest cards: once the top three interest types
 * can't change whatever those cards get (`interestsSettled`), they become optional. The interest
 * attention check sits in task 5.
 *
 * Within each type the cards come easiest first (`EASY_FIRST`): everyday activities anyone can picture
 * open Discover, and the ones that assume some knowledge (stocks, therapy, contracts…) come later,
 * most of them in tasks 9–10. Only the order changes, never a card's wording.
 */

export type DiscoverFormat = 'swipe' | 'faces' | 'slider';
export type DiscoverInstrument = 'interests' | 'personality' | 'abilities';

export interface DiscoverItem {
  id: string;
  instrumentId: DiscoverInstrument;
  format: DiscoverFormat;
  text: I18n;
  /** "What does this mean?" for an interest card that assumes some knowledge. */
  hint?: I18n;
}

export interface DiscoverTask {
  /** 1-based task number. */
  n: number;
  items: DiscoverItem[];
  /** A game played after the questions (docs/product/games.md); the task is done once it's played. */
  game?: GameId;
}

export const DISCOVER_TASKS = 10;
/** Tasks 1–8 hold everything but the last two interest cards of each type. */
export const CORE_TASKS = 8;
/** Personality statements per task (20 in all). */
const PERSONALITY_PER_TASK = [3, 3, 3, 3, 2, 2, 2, 2, 0, 0];
/** Strengths per task (12 in all). */
const STRENGTHS_PER_TASK = [2, 2, 1, 1, 2, 1, 1, 2, 0, 0];
/** Task (0-based) that holds the attention check. */
const CHECK_TASK = 4;
/** Share of each interest type's cards needed to score it (the engine's minimum coverage). */
const INTEREST_COVERAGE = 0.8;

/**
 * Interest cards per type, from the easiest to picture to the most specialised (our judgement, for the
 * psychologist to review: docs/product/discover-verify.md §8). Task k gets the k-th card of each type.
 */
export const EASY_FIRST: Record<string, readonly string[]> = {
  R: ['ip_R03', 'ip_R01', 'ip_R02', 'ip_R08', 'ip_R05', 'ip_R06', 'ip_R04', 'ip_R09', 'ip_R07', 'ip_R10'],
  I: ['ip_I03', 'ip_I05', 'ip_I04', 'ip_I09', 'ip_I08', 'ip_I02', 'ip_I06', 'ip_I10', 'ip_I01', 'ip_I07'],
  A: ['ip_A04', 'ip_A02', 'ip_A01', 'ip_A09', 'ip_A10', 'ip_A07', 'ip_A05', 'ip_A06', 'ip_A03', 'ip_A08'],
  S: ['ip_S06', 'ip_S09', 'ip_S05', 'ip_S01', 'ip_S10', 'ip_S02', 'ip_S07', 'ip_S03', 'ip_S04', 'ip_S08'],
  E: ['ip_E10', 'ip_E05', 'ip_E09', 'ip_E03', 'ip_E02', 'ip_E08', 'ip_E04', 'ip_E06', 'ip_E07', 'ip_E01'],
  C: ['ip_C04', 'ip_C01', 'ip_C05', 'ip_C08', 'ip_C10', 'ip_C09', 'ip_C06', 'ip_C07', 'ip_C02', 'ip_C03'],
};
const ease = (id: string, type: string) => {
  const i = EASY_FIRST[type]?.indexOf(id) ?? -1;
  return i === -1 ? Infinity : i;
};

let cache: DiscoverTask[] | null = null;

/** Spreads `extra` among `base` evenly (base first): swipe, swipe, face, swipe, slider, … */
function interleave<T>(base: T[], extra: T[]): T[] {
  if (!extra.length) return base;
  const out: T[] = [];
  const gap = (base.length + 1) / (extra.length + 1);
  let e = 0;
  base.forEach((b, i) => {
    out.push(b);
    while (e < extra.length && i + 1 >= Math.round(gap * (e + 1))) out.push(extra[e++]!);
  });
  return [...out, ...extra.slice(e)];
}

export function discoverPlan(): DiscoverTask[] {
  if (cache) return cache;
  const interests = instruments.interests.items;
  const byType = RIASEC.map((t) => interests.filter((i) => i.scale === t && !i.attentionCheck).sort((a, b) => ease(a.id, t) - ease(b.id, t)));
  const check = interests.find((i) => i.attentionCheck);

  const short = personalityShort().items;
  const traitLists = BIG_FIVE.map((t) => short.filter((i) => i.scale === t));
  // Interleave traits (E, A, C, N, O, E, A, …) so two neighbours are never the same trait.
  const personality = traitLists[0]!.flatMap((_, k) => traitLists.map((l) => l[k]!)).filter(Boolean);

  const strengths = instruments.abilities.selfRatings;
  let p = 0;
  let s = 0;

  const tasks: DiscoverTask[] = [];
  for (let k = 0; k < DISCOVER_TASKS; k++) {
    // Rotate the type order per task so the same type doesn't always come first.
    const swipes: DiscoverItem[] = RIASEC.map((_, j) => byType[(j + k) % 6]![k]!).map((i) => ({
      id: i.id,
      instrumentId: 'interests',
      format: 'swipe',
      text: i.text,
      ...(i.hint ? { hint: i.hint } : {}),
    }));
    if (k === CHECK_TASK && check) swipes.splice(4, 0, { id: check.id, instrumentId: 'interests', format: 'swipe', text: check.text });
    const faces: DiscoverItem[] = personality
      .slice(p, (p += PERSONALITY_PER_TASK[k]!))
      .map((i) => ({ id: i.id, instrumentId: 'personality', format: 'faces', text: i.text }));
    const sliders: DiscoverItem[] = strengths
      .slice(s, (s += STRENGTHS_PER_TASK[k]!))
      .map((i) => ({ id: i.id, instrumentId: 'abilities', format: 'slider', text: i.text }));

    const others = interleave(faces, sliders);
    const items = interleave(swipes, others);
    const game = DISCOVER_GAMES[k + 1];
    tasks.push({ n: k + 1, items, ...(game ? { game } : {}) });
  }
  cache = tasks;
  return tasks;
}

/**
 * Whether the three strongest interest types are already certain: every type has enough cards
 * answered to be scored, and even if the cards left went the worst way for the top three and the best
 * way for the rest, the top three would stay the top three. Then tasks 9–10 are optional.
 */
export function interestsSettled(answers: Readonly<Record<string, number>>): boolean {
  const { min, max } = instruments.interests.responseScale;
  const ranges: { now: number; lo: number; hi: number }[] = [];
  for (const type of RIASEC) {
    const items = instruments.interests.items.filter((i) => i.scale === type && !i.attentionCheck);
    const values = items.flatMap((i) => (answers[i.id] === undefined ? [] : [i.keyed === -1 ? min + max - answers[i.id]! : answers[i.id]!]));
    if (values.length < Math.ceil(items.length * INTEREST_COVERAGE)) return false;
    const sum = values.reduce((a, b) => a + b, 0);
    const left = items.length - values.length;
    ranges.push({ now: sum / values.length, lo: (sum + left * min) / items.length, hi: (sum + left * max) / items.length });
  }
  const ranked = [...ranges].sort((a, b) => b.now - a.now);
  const floor = Math.min(...ranked.slice(0, 3).map((r) => r.lo));
  const ceiling = Math.max(...ranked.slice(3).map((r) => r.hi));
  return floor > ceiling;
}

/**
 * Which tasks are done, given the ids answered so far (questions, and `game_<id>` for games played).
 * Games count while the assessment is open; once a result exists they are optional extras, so a
 * Discover finished before the games existed doesn't go backwards.
 */
export function discoverStatus(answered: ReadonlySet<string>, { gamesRequired = true, settled = false }: { gamesRequired?: boolean; settled?: boolean } = {}) {
  const plan = discoverPlan();
  const done = plan.map((t) => t.items.every((i) => answered.has(i.id)) && (!gamesRequired || !t.game || answered.has(gameStepId(t.game))));
  // Tasks 9–10 are only interest cards; when the top three can't change any more they are a bonus.
  const optional = plan.map((t) => settled && t.n > CORE_TASKS);
  const next = done.findIndex((d, i) => !d && !optional[i]);
  const required = optional.filter((o) => !o).length;
  return { done, optional, doneCount: done.filter((d, i) => d && !optional[i]).length, required, next: next === -1 ? null : next + 1 };
}
