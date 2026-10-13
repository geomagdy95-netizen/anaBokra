import { paths } from '@anabokra/content';

import { GROUP_ORDER, type GroupId, type IslandState } from '@/features/world/types';
import type { Preview } from '@/server/assessment/scoring';

import { taskDone, type JourneyDoc } from './verify';

/**
 * Island states for the map from real progress:
 * - before any suggestion every path is neutral and open;
 * - suggested paths (top 3) glow, and their bridges show "updating" while it's only an early guess;
 * - paths the user added to their map, or started or checked, outside the top 3 count as added by them;
 * - the rest stay open to explore, with a gap in the bridge.
 * A bridge's progress is the number of Verify tasks done (3 per path).
 */
export function islandStates(preview: Preview, journey: JourneyDoc): Record<GroupId, IslandState> {
  const top = preview.stage === 'none' || preview.flat ? [] : preview.groups.slice(0, 3).map((g) => g.cluster);
  const out = {} as Record<GroupId, IslandState>;
  for (const id of GROUP_ORDER) {
    const rec = journey.paths[id];
    const content = paths[id];
    const total = content?.tasks.length ?? 3;
    const done = content && rec ? content.tasks.filter((t) => taskDone(t, rec.answers)).length : 0;
    const started = Boolean(rec && (rec.result || Object.keys(rec.answers).length)) || Boolean(journey.added?.includes(id));
    const relation = top.includes(id) ? 'suggested' : started ? 'added' : preview.stage === 'none' ? 'neutral' : 'other';
    const bridge = relation === 'other' ? 'broken' : relation === 'suggested' && preview.stage === 'early' ? 'updating' : 'connected';
    out[id] = { id, relation, bridge, done, total };
  }
  return out;
}
