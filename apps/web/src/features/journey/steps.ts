import { enjoyId, instruments, type PathTask } from '@anabokra/content';
import type { I18n } from '@anabokra/engine';

import { discoverArt, pathArt, type ArtChain } from '@/features/art/task-art';
import type { DiscoverTask } from '@/lib/journey/discover-plan';
import type { AnswerFormats } from '@/server/assessment/config';
import { gameStepId, type GameId } from '@/lib/journey/games';

/**
 * One screen of a task. Discover steps are validated questions (their answer is the item's own
 * scale value); path steps are Verify questions (docs/product/discover-verify.md §5).
 */
export interface Scale {
  min: number;
  max: number;
  labels: I18n[];
}

/** A validated question (Discover): its answer is the item's own scale value. */
export type ItemStep = { kind: 'swipe' | 'faces' | 'slider'; id: string; instrumentId: 'interests' | 'personality' | 'abilities'; text: I18n; hint?: I18n; scale: Scale; title?: I18n; art?: ArtChain };

export type Step = (
  | ItemStep
  /** Interest cards on one screen: tap the ones you'd enjoy (checklist). `checkId` is the attention check. */
  | { kind: 'grid'; id: string; parts: ItemStep[]; checkId?: string }
  /** Several statements on one screen, each with its own compact scale. */
  | { kind: 'stack'; id: string; parts: ItemStep[] }
  | { kind: 'story'; id: string; text: I18n }
  | { kind: 'choice'; id: string; a: I18n; b: I18n }
  | { kind: 'scenario'; id: string; text: I18n; options: I18n[] }
  | { kind: 'puzzle'; id: string; text: I18n; options: I18n[]; answer: number; explain: I18n }
  | { kind: 'enjoy'; id: string }
  /** Readiness statements, 1–5 agreement. */
  | { kind: 'agree'; id: string; text: I18n; scale: Scale }
  /** A game played inside a Discover task (docs/product/games.md). Answered once it's played. */
  | { kind: 'game'; id: string; game: GameId }
) & {
  /** Short heading for the screen (the task title is used without one). */
  title?: I18n;
  /** The picture at the top of the screen, most specific first. */
  art?: ArtChain;
};

const SCALES: Record<'interests' | 'personality' | 'abilities', Scale> = {
  interests: { ...instruments.interests.responseScale },
  personality: { ...instruments.personality.responseScale },
  abilities: { ...instruments.abilities.selfRatingScale },
};

/** The ids a step answers: its own, or each of its parts'. */
export const stepIds = (step: Step): string[] => (step.kind === 'grid' || step.kind === 'stack' ? step.parts.map((p) => p.id) : [step.id]);
export const stepAnswered = (step: Step, answers: Readonly<Record<string, number>>) => stepIds(step).every((id) => answers[id] !== undefined);

/**
 * A Discover task as screens. On the 1–5 scale, one question per screen. As a checklist: the
 * interest cards on one screen, then the personality statements together, then the strengths together.
 */
export function discoverSteps(task: DiscoverTask, format: AnswerFormats['interests'] = 'scale'): Step[] {
  const art = discoverArt(task.n);
  const items: ItemStep[] = task.items.map((i) => ({ kind: i.format, id: i.id, instrumentId: i.instrumentId, text: i.text, ...(i.hint ? { hint: i.hint } : {}), scale: SCALES[i.instrumentId], art }));
  const game: Step[] = task.game ? [{ kind: 'game', id: gameStepId(task.game), game: task.game, art }] : [];
  if (format === 'scale') return [...items, ...game];
  const check = instruments.interests.items.find((i) => i.attentionCheck)?.id;
  const of = (instrumentId: ItemStep['instrumentId']) => items.filter((i) => i.instrumentId === instrumentId);
  const interests = of('interests');
  const screens: Step[] = [
    { kind: 'grid', id: `grid_${task.n}`, parts: interests, art, ...(interests.some((i) => i.id === check) ? { checkId: check } : {}) },
    ...(of('personality').length ? [{ kind: 'stack' as const, id: `about_${task.n}`, parts: of('personality'), art }] : []),
    ...(of('abilities').length ? [{ kind: 'stack' as const, id: `strengths_${task.n}`, parts: of('abilities'), art }] : []),
  ];
  return [...screens, ...game];
}

/** The six readiness statements (baseline before Discover, follow-up later). */
export function readinessSteps(): Step[] {
  const r = instruments.readiness;
  const art = ['tasks/discover/readiness', ...discoverArt()];
  return r.items.map((i) => ({ kind: 'agree', id: i.id, text: i.text, scale: { ...r.responseScale }, art }));
}

/** A path task as steps; every "Try it" item is followed by "Did you enjoy that?" (same picture). */
export function pathSteps(task: PathTask, pathId: string): Step[] {
  const art = (itemId: string) => pathArt(pathId, task.id, itemId);
  switch (task.kind) {
    case 'story':
      return task.items.map((i) => ({ kind: 'story', id: i.id, text: i.text, title: i.title, art: art(i.id) }));
    case 'thisOrThat':
      return task.items.map((i) => ({ kind: 'choice', id: i.id, a: i.a, b: i.b, title: i.title, art: art(i.id) }));
    case 'tryIt':
      return task.items.flatMap((i): Step[] => [
        i.type === 'puzzle'
          ? { kind: 'puzzle', id: i.id, text: i.text, options: i.options, answer: i.answer, explain: i.explain, title: i.title, art: art(i.id) }
          : { kind: 'scenario', id: i.id, text: i.text, options: i.options.map((o) => o.text), title: i.title, art: art(i.id) },
        { kind: 'enjoy', id: enjoyId(i.id), title: i.title, art: art(i.id) },
      ]);
  }
}
