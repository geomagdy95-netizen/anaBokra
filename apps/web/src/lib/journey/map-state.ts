import { paths } from '@anabokra/content';

import { GROUP_ORDER, type GroupId, type IslandState } from '@/features/world/types';
import type { Preview } from '@/server/assessment/scoring';

import { taskDone, type JourneyDoc } from './verify';

/**
 * Island states for the map from real progress. The map starts with only the user's own island:
 * - before any suggestion no field is on the map (all neutral);
 * - then the top 3 suggestions appear and glow, with "updating" bridges while it's an early guess;
 * - fields the user adds, starts or checks join the map as added by them;
 * - everything else stays off the map, to find in the list or search and add.
 * A field the user takes off the map (hidden) stays off, answers kept. Islands take spots round the
 * core in the order they appeared (`slot`). A bridge's progress is the number of Verify tasks done
 * (3 per path); the island grows with it, to full once checked.
 */
export function islandStates(preview: Preview, journey: JourneyDoc): Record<GroupId, IslandState> {
  const top = preview.stage === 'none' || preview.flat ? [] : preview.groups.slice(0, 3).map((g) => g.cluster);
  const hidden = new Set(journey.hidden ?? []);
  const isStarted = (id: string) => {
    const rec = journey.paths[id];
    return Boolean(rec && (rec.result || Object.keys(rec.answers).length));
  };
  // Order of appearance: suggestions by rank, then fields the user added, then any other started path.
  const order = [...new Set([...top, ...(journey.added ?? []), ...GROUP_ORDER.filter(isStarted)])].filter(
    (id): id is GroupId => (GROUP_ORDER as readonly string[]).includes(id) && !hidden.has(id),
  );
  const out = {} as Record<GroupId, IslandState>;
  for (const id of GROUP_ORDER) {
    const rec = journey.paths[id];
    const content = paths[id];
    const total = content?.tasks.length ?? 3;
    const done = content && rec ? content.tasks.filter((t) => taskDone(t, rec.answers)).length : 0;
    const started = Boolean(rec && (rec.result || Object.keys(rec.answers).length)) || Boolean(journey.added?.includes(id));
    const relation = top.includes(id) ? 'suggested' : started ? 'added' : preview.stage === 'none' ? 'neutral' : 'other';
    const bridge = relation === 'other' ? 'broken' : relation === 'suggested' && preview.stage === 'early' ? 'updating' : 'connected';
    const checked = Boolean(rec?.result);
    const slot = order.indexOf(id);
    out[id] = { id, relation, bridge, done, total, growth: checked ? 1 : (done / total) * 0.75, checked, visible: slot >= 0, ...(slot >= 0 ? { slot } : {}) };
  }
  return out;
}

/** How far the core island (the user) has grown: one step per Discover task. */
export const coreGrowth = (discoverDone: number, discoverTotal = 10) => Math.min(1, discoverDone / discoverTotal);
