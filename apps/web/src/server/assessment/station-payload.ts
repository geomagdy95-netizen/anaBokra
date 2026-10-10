import { WORK_VALUES, type LikertItem } from '@anabokra/engine';

import { interleaveByScale } from '@/features/assessment/order';
import type { StationPayload } from '@/features/assessment/types';

import { abilitiesInstrument, likert, valuesInstrument, type StationId } from './config';

/** Everything the player needs for one station. Answer keys (attention checks, puzzle solutions) stay on the server. */
export function stationPayload(id: Exclude<StationId, 'context'>): StationPayload {
  if (id === 'interests' || id === 'personality') {
    const ins = likert(id);
    const items: LikertItem[] = id === 'interests' ? interleaveByScale(ins.items) : ins.items;
    return {
      kind: 'likert',
      scale: { min: ins.responseScale.min, max: ins.responseScale.max, labels: ins.responseScale.labels },
      items: items.map((i) => ({ id: i.id, text: i.text })),
    };
  }
  if (id === 'values') {
    const v = valuesInstrument();
    return {
      kind: 'values',
      buckets: v.buckets.map((b) => ({ id: b.id, name: b.name, weight: b.weight, ...(b.limit !== undefined ? { limit: b.limit } : {}) })),
      cards: v.cards.map((c) => ({ id: c.id, value: c.value, text: c.text })),
      workValues: [...WORK_VALUES],
    };
  }
  const a = abilitiesInstrument();
  return {
    kind: 'abilities',
    scale: { min: a.selfRatingScale.min, max: a.selfRatingScale.max, labels: a.selfRatingScale.labels },
    self: a.selfRatings.map((s) => ({ id: s.id, text: s.text })),
    performance: a.performance.map((p) => ({
      id: p.id,
      prompt: p.prompt,
      options: p.options,
      ...(p.media ? { media: p.media } : {}),
    })),
  };
}
