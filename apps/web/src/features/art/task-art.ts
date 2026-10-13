import manifest from './manifest.json';

/**
 * Illustrations for island tasks (docs/art/README.md). Files live in /public/art as WebP and are
 * listed in manifest.json by `pnpm --filter web art:build`, so the app only asks for images that
 * exist. Every screen names a chain of keys from the most specific (the question) to the most general
 * (the island); the first one with a file wins, and with none the screen shows a drawn placeholder.
 */

const files: Record<string, string> = (manifest as { files: Record<string, string> }).files;

/** Keys, most specific first. */
export type ArtChain = string[];

export const pathArt = (pathId: string, taskId?: string, itemId?: string): ArtChain =>
  [itemId && `tasks/${pathId}/${itemId}`, taskId && `tasks/${pathId}/${taskId}`, `tasks/${pathId}/cover`].filter(Boolean) as string[];

export const discoverArt = (n?: number): ArtChain => [n !== undefined && `tasks/discover/task_${n}`, 'tasks/discover/cover'].filter(Boolean) as string[];

/** URL of the first image in the chain that exists (versioned by its content hash), or null. */
export function artUrl(chain: ArtChain | undefined): string | null {
  for (const key of chain ?? []) {
    const hash = files[key];
    if (hash) return `/art/${key}.webp?v=${hash}`;
  }
  return null;
}

/** Which island a chain belongs to, for the placeholder's colours and icon. */
export const artGroup = (chain: ArtChain | undefined): string => chain?.[chain.length - 1]?.split('/')[1] ?? 'discover';
