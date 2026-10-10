import type { I18n } from '@anabokra/engine';

export type { I18n };
export type Gender = 'female' | 'male';
export type Locale = 'ar' | 'en';

/** Client-safe description of one station's questions. Built on the server from @anabokra/content; never carries answer keys. */
export interface ScalePayload {
  min: number;
  max: number;
  labels: I18n[];
}

export interface ItemPayload {
  id: string;
  text: I18n;
}

export interface LikertPayload {
  kind: 'likert';
  scale: ScalePayload;
  /** Already in display order (scales interleaved). Attention checks are ordinary items. */
  items: ItemPayload[];
}

export interface ValuesPayload {
  kind: 'values';
  buckets: { id: string; name: I18n; weight: number; limit?: number }[];
  cards: { id: string; value: string; text: I18n }[];
  /** The six work values, ranked at the end. */
  workValues: string[];
}

export interface PuzzlePayload {
  id: string;
  prompt: I18n;
  options: I18n[];
  /** Optional media key (matrix image, 3D model...). */
  media?: string;
}

export interface AbilitiesPayload {
  kind: 'abilities';
  scale: ScalePayload;
  self: ItemPayload[];
  /** Empty until the performance items arrive (ICAR). */
  performance: PuzzlePayload[];
}

export type StationPayload = LikertPayload | ValuesPayload | AbilitiesPayload;

export type AnswerMap = Record<string, number>;
