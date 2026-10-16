import { careers, enjoyId, type PathContent, type PathTask } from '@anabokra/content';

/**
 * Verify as one story, "a day in their shoes" (docs/product/discover-verify.md §5.2): a chat that
 * mixes the path's three kinds of content instead of three tasks one after another. It asks a
 * selection, not every item: the day moments and trade-offs that together touch the most careers of
 * the path, and the first "Try it" items (with at least one puzzle). Answers keep the ids and values
 * of the tasks (verify.ts), so scoring and research are unchanged.
 */

type TaskItems<K extends PathTask['kind']> = Extract<PathTask, { kind: K }>['items'];
export type MomentItem = TaskItems<'story'>[number];
export type ChoiceItem = TaskItems<'thisOrThat'>[number];
export type TryItem = TaskItems<'tryIt'>[number];

export type Beat = { kind: 'moment'; item: MomentItem } | { kind: 'choice'; item: ChoiceItem } | { kind: 'try'; item: TryItem };

/** How many of each the story asks (draft, ~12 beats, about 3 minutes). */
export const STORY_SIZE = { moment: 5, choice: 4, try: 3 } as const;

/** The task id each beat's item comes from (for its picture). */
export const BEAT_TASK = { moment: 'day', choice: 'real', try: 'try' } as const;

/**
 * Picks `n` items, greedily the one that touches the most careers not touched yet (an item without a
 * list applies to all of them), ties in content order; the picks keep content order.
 */
function cover<T extends { careers?: string[] }>(items: readonly T[], n: number, all: readonly string[]): T[] {
  const touched = new Set<string>();
  const picked = new Set<number>();
  while (picked.size < Math.min(n, items.length)) {
    let best = -1;
    let gain = -1;
    items.forEach((item, i) => {
      if (picked.has(i)) return;
      const g = (item.careers?.length ? item.careers : all).filter((c) => !touched.has(c)).length;
      if (g > gain) [best, gain] = [i, g];
    });
    picked.add(best);
    for (const c of items[best]!.careers?.length ? items[best]!.careers! : all) touched.add(c);
  }
  return items.filter((_, i) => picked.has(i));
}

/** The first `n` "Try it" items, with a puzzle among them when the path has one. */
function tries(items: readonly TryItem[], n: number): TryItem[] {
  const out = items.slice(0, n);
  const puzzle = items.find((i) => i.type === 'puzzle');
  if (puzzle && !out.includes(puzzle) && out.length) out[out.length - 1] = puzzle;
  return out;
}

const cache = new Map<string, Beat[]>();

/** The story's beats in order: the three kinds spread evenly, opening with a moment. */
export function storyPlan(path: PathContent): Beat[] {
  const key = `${path.id}@${path.version}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const all = careers.filter((c) => c.cluster === path.id).map((c) => c.id);
  const of = <K extends PathTask['kind']>(kind: K) => (path.tasks.find((t) => t.kind === kind)?.items ?? []) as TaskItems<K>;
  const queues = {
    moment: cover(of('story'), STORY_SIZE.moment, all).map((item): Beat => ({ kind: 'moment', item })),
    choice: cover(of('thisOrThat'), STORY_SIZE.choice, all).map((item): Beat => ({ kind: 'choice', item })),
    try: tries(of('tryIt'), STORY_SIZE.try).map((item): Beat => ({ kind: 'try', item })),
  };
  const sizes = { moment: queues.moment.length, choice: queues.choice.length, try: queues.try.length };
  const used = { moment: 0, choice: 0, try: 0 };
  const beats: Beat[] = [];
  const kinds = ['moment', 'choice', 'try'] as const;
  while (beats.length < sizes.moment + sizes.choice + sizes.try) {
    // The kind furthest behind its even share goes next.
    const kind = kinds.filter((k) => used[k] < sizes[k]).sort((a, b) => (used[a] + 0.5) / sizes[a] - (used[b] + 0.5) / sizes[b])[0]!;
    beats.push(queues[kind][used[kind]++]!);
  }
  cache.set(key, beats);
  return beats;
}

/** The answer ids a beat needs ("Try it" also needs "did you enjoy that?"). */
export const beatIds = (beat: Beat): string[] => (beat.kind === 'try' ? [beat.item.id, enjoyId(beat.item.id)] : [beat.item.id]);

export const beatDone = (beat: Beat, answers: Readonly<Record<string, number>>) => beatIds(beat).every((id) => answers[id] !== undefined);

/** Whether the story is answered (answers to items outside it don't matter). */
export const storyDone = (path: PathContent, answers: Readonly<Record<string, number>>) => storyPlan(path).every((b) => beatDone(b, answers));
