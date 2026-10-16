import { pathById } from '@anabokra/content';

import { GROUP_ORDER, type GroupId, type IslandState } from '@/features/world/types';

import { careerState } from './career-quest';
import type { JourneyData } from './journey';
import { islandStates } from './map-state';

/** The one thing the map suggests doing next (the glass pill at the bottom of the map). */
export type NextStep =
  | { kind: 'task'; n: number; first: boolean }
  | { kind: 'field'; id: GroupId; started: boolean }
  | { kind: 'career'; group: GroupId; id: string; started: boolean }
  | { kind: 'explore' };

/**
 * Pure. In order: the next Discover task; a field the user started checking; the best suggested field
 * not checked yet; a career quest the user started; the best career of a checked field not tried yet.
 * Fields can only be checked once suggestions are ready (as on the island sheet).
 */
export function nextStep(data: Pick<JourneyData, 'discover' | 'preview' | 'journey' | 'open'>, states: Record<GroupId, IslandState> = islandStates(data.preview, data.journey)): NextStep {
  const { discover, preview, journey } = data;
  if (data.open && discover.next !== null) return { kind: 'task', n: discover.next, first: discover.doneCount === 0 };

  const onMap = GROUP_ORDER.filter((id) => states[id].visible !== false).sort((a, b) => (states[a].slot ?? 0) - (states[b].slot ?? 0));
  if (preview.stage === 'suggested') {
    const checkable = onMap.filter((id) => pathById(id) && !states[id].checked);
    const started = checkable.find((id) => Object.keys(journey.paths[id]?.answers ?? {}).length > 0);
    if (started) return { kind: 'field', id: started, started: true };
    const suggested = checkable.find((id) => states[id].relation === 'suggested');
    if (suggested) return { kind: 'field', id: suggested, started: false };
  }

  const checked = onMap.filter((id) => journey.paths[id]?.result);
  const top = checked.flatMap((g) => journey.paths[g]!.result!.careers.slice(0, 3).map((c) => ({ group: g, id: c.careerId })));
  const building = top.find((c) => careerState(journey, c.id) === 'building');
  if (building) return { kind: 'career', ...building, started: true };
  const fresh = top.find((c) => careerState(journey, c.id) === 'available');
  if (fresh) return { kind: 'career', ...fresh, started: false };
  return { kind: 'explore' };
}

/** Where the next step leads. */
export function nextStepHref(step: NextStep): string | null {
  switch (step.kind) {
    case 'task':
      return `/journey/me?task=${step.n}`;
    case 'field':
      return `/journey/${step.id}`;
    case 'career':
      return `/journey/${step.group}/${step.id}`;
    case 'explore':
      return null;
  }
}
