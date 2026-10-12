import { enjoyId, instruments, type PathTask } from '@anabokra/content';
import type { I18n } from '@anabokra/engine';

import type { DiscoverTask } from '@/lib/journey/discover-plan';

/**
 * One screen of a task. Discover steps are validated questions (their answer is the item's own
 * scale value); path steps are Verify questions (docs/product/discover-verify.md §5).
 */
export interface Scale {
  min: number;
  max: number;
  labels: I18n[];
}

export type Step =
  | { kind: 'swipe' | 'faces' | 'slider'; id: string; instrumentId: 'interests' | 'personality' | 'abilities'; text: I18n; scale: Scale }
  | { kind: 'story'; id: string; text: I18n }
  | { kind: 'choice'; id: string; a: I18n; b: I18n }
  | { kind: 'scenario'; id: string; text: I18n; options: I18n[] }
  | { kind: 'puzzle'; id: string; text: I18n; options: I18n[]; answer: number; explain: I18n }
  | { kind: 'enjoy'; id: string }
  /** Readiness statements, 1–5 agreement. */
  | { kind: 'agree'; id: string; text: I18n; scale: Scale };

const SCALES: Record<'interests' | 'personality' | 'abilities', Scale> = {
  interests: { ...instruments.interests.responseScale },
  personality: { ...instruments.personality.responseScale },
  abilities: { ...instruments.abilities.selfRatingScale },
};

export function discoverSteps(task: DiscoverTask): Step[] {
  return task.items.map((i) => ({ kind: i.format, id: i.id, instrumentId: i.instrumentId, text: i.text, scale: SCALES[i.instrumentId] }));
}

/** The six readiness statements (baseline before Discover, follow-up later). */
export function readinessSteps(): Step[] {
  const r = instruments.readiness;
  return r.items.map((i) => ({ kind: 'agree', id: i.id, text: i.text, scale: { ...r.responseScale } }));
}

/** A path task as steps; every "Try it" item is followed by "Did you enjoy that?". */
export function pathSteps(task: PathTask): Step[] {
  switch (task.kind) {
    case 'story':
      return task.items.map((i) => ({ kind: 'story', id: i.id, text: i.text }));
    case 'thisOrThat':
      return task.items.map((i) => ({ kind: 'choice', id: i.id, a: i.a, b: i.b }));
    case 'tryIt':
      return task.items.flatMap((i): Step[] => [
        i.type === 'puzzle'
          ? { kind: 'puzzle', id: i.id, text: i.text, options: i.options, answer: i.answer, explain: i.explain }
          : { kind: 'scenario', id: i.id, text: i.text, options: i.options.map((o) => o.text) },
        { kind: 'enjoy', id: enjoyId(i.id) },
      ]);
  }
}
