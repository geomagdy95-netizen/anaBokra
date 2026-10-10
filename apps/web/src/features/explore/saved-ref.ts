import { programById, providerById, universityById } from '@anabokra/content';

export const SAVED_KINDS = ['program', 'university', 'provider'] as const;
export type SavedKind = (typeof SAVED_KINDS)[number];

/** A saved item is addressed as "kind:id", e.g. "program:cairo-university-medicine". */
export type SavedRef = `${SavedKind}:${string}`;

export const makeRef = (kind: SavedKind, id: string): SavedRef => `${kind}:${id}`;

export function parseRef(ref: string): { kind: SavedKind; id: string } | null {
  const i = ref.indexOf(':');
  if (i < 1) return null;
  const kind = ref.slice(0, i);
  const id = ref.slice(i + 1);
  if (!id || !(SAVED_KINDS as readonly string[]).includes(kind)) return null;
  return { kind: kind as SavedKind, id };
}

/** True when the ref points at something in the content package. */
export function refExists(ref: string): boolean {
  const p = parseRef(ref);
  if (!p) return false;
  return p.kind === 'program' ? !!programById(p.id) : p.kind === 'university' ? !!universityById(p.id) : !!providerById(p.id);
}

export type SavedFailure = 'unauthenticated' | 'consent_required' | 'not_found' | 'unavailable' | 'network';
