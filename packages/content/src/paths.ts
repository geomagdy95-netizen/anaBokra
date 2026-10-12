import type { I18n } from '@anabokra/engine';

import businessJson from '../paths/business.json';
import engineeringJson from '../paths/engineering.json';
import healthJson from '../paths/health.json';
import techJson from '../paths/tech.json';

/**
 * Verify content for path (career-group) islands (docs/product/discover-verify.md §5). Drafts until
 * the psychologist approves them. Each item lists the careers it applies to; without a list it
 * applies to every career in the path.
 */

/** "A day as…": a moment from the path's everyday work. Answer: 1 not for me, 2 OK, 3 sounds great. */
export interface PathStoryItem {
  id: string;
  text: I18n;
  careers?: string[];
}

/** "The real deal": a trade-off. Answer: 0 = a, 1 = b. `path` is the side typical of this path. */
export interface PathChoiceItem {
  id: string;
  a: I18n;
  b: I18n;
  path: 'a' | 'b';
  careers?: string[];
}

/** "Try it": a work situation. Answer: the option index. `fit` is how typical a response is of the path (0–1). */
export interface PathScenarioItem {
  id: string;
  type: 'scenario';
  text: I18n;
  options: { text: I18n; fit: number }[];
  careers?: string[];
}

/** "Try it": a small puzzle, a taste test rather than a test. Answer: the option index. */
export interface PathPuzzleItem {
  id: string;
  type: 'puzzle';
  text: I18n;
  options: I18n[];
  answer: number;
  explain: I18n;
  careers?: string[];
}

export type PathTask =
  | { id: 'day'; kind: 'story'; title: I18n; intro: I18n; items: PathStoryItem[] }
  | { id: 'real'; kind: 'thisOrThat'; title: I18n; intro: I18n; items: PathChoiceItem[] }
  | { id: 'try'; kind: 'tryIt'; title: I18n; intro: I18n; items: (PathScenarioItem | PathPuzzleItem)[] };

export interface PathContent {
  /** The career group (cluster) id. */
  id: string;
  version: string;
  status: string;
  tasks: PathTask[];
}

/** After every "Try it" item the user says whether they enjoyed it: 1 not really, 2 kind of, 3 loved it. */
export const enjoyId = (itemId: string) => `${itemId}_enjoy`;

export const paths: Record<string, PathContent> = Object.fromEntries(
  [techJson, businessJson, engineeringJson, healthJson].map((p) => [p.id, p as unknown as PathContent]),
);

export const pathById = (id: string): PathContent | undefined => paths[id];
