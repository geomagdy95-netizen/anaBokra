/** The 12 career groups (catalog clusters). Each one is an L1 group island. */
export type GroupId =
  | 'health'
  | 'engineering'
  | 'tech'
  | 'business'
  | 'media'
  | 'creative'
  | 'law'
  | 'education'
  | 'science'
  | 'tourism'
  | 'trades'
  | 'agriculture';

/** Clockwise from the top of the map. Neighbours share interests, so related groups sit side by side. */
export const GROUP_ORDER: readonly GroupId[] = [
  'tech',
  'science',
  'health',
  'agriculture',
  'tourism',
  'education',
  'law',
  'business',
  'media',
  'creative',
  'engineering',
  'trades',
];

export interface I18nText {
  en: string;
  ar: string;
}

export interface GroupInfo {
  id: GroupId;
  name: I18nText;
  /** Number of careers in the library for this group. */
  careers: number;
}

/**
 * How a group relates to the user right now (drives the bridge colour):
 * - neutral: before results, every group is open
 * - suggested: in the user's current suggestions
 * - added: the user added it to their map themselves
 * - other: outside the current suggestions, still open to explore
 */
export type Relation = 'neutral' | 'suggested' | 'added' | 'other';

/** connected: walkable bridge. updating: answers are changing it. broken: a gap that can be reopened. */
export type BridgeMode = 'connected' | 'updating' | 'broken';

export interface IslandState {
  id: GroupId;
  /** Whether the island is on the user's map. Missing means shown (the dev world shows all). */
  visible?: boolean;
  /** Its place round the core, in the order islands appeared on the map (see layout SLOT_ORDER). */
  slot?: number;
  relation: Relation;
  bridge: BridgeMode;
  /** Bridge progress: finished phases out of total. */
  done: number;
  total: number;
  /** 0–1: how far the island has grown (trees, bushes, flowers). Full when missing. */
  growth?: number;
  /** The user checked this path (Verify result): the island flies a small flag. */
  checked?: boolean;
}

/** What the user tapped: a group island, or the core island (their profile). */
export type Selection = GroupId | 'core';

export type Scenario = 'before' | 'during' | 'after' | 'added';
export const SCENARIOS: readonly Scenario[] = ['before', 'during', 'after', 'added'];
