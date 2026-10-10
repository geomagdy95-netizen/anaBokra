import { createHash } from 'node:crypto';
import type { ExplanationCache, Gender, Locale } from './types';

/** Bump when the system prompt, user payload shape or guardrails change so old generations are not reused. */
export const PROMPT_VERSION = '1';

export interface CacheKeyParts {
  resultId: string;
  careerId: string;
  locale: Locale;
  gender: Gender;
  engineVersion: string;
  promptVersion: string;
}

/** Stable hash used as the `ai_generations` lookup key. */
export function cacheKey(p: CacheKeyParts): string {
  return createHash('sha256')
    .update(JSON.stringify([p.resultId, p.careerId, p.locale, p.gender, p.engineVersion, p.promptVersion]))
    .digest('hex');
}

export class InMemoryExplanationCache implements ExplanationCache {
  private readonly store = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this.store.get(key);
  }

  async set(key: string, text: string): Promise<void> {
    this.store.set(key, text);
  }

  get size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}

/** Process-wide default so repeated calls in one server instance share generations. */
export const defaultCache = new InMemoryExplanationCache();
