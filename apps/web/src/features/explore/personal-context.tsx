'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { EMPTY_EXPLORE_PERSONAL, type ExplorePersonal } from './types';
import type { SavedFailure } from './saved-ref';

interface Value {
  data: ExplorePersonal;
  ready: boolean;
  isSaved(ref: string): boolean;
  /** Optimistic; resolves to null on success or the failure code (state rolled back). */
  toggleSaved(ref: string): Promise<SavedFailure | null>;
}

const Ctx = createContext<Value>({ data: EMPTY_EXPLORE_PERSONAL, ready: false, isSaved: () => false, toggleSaved: async () => 'unauthenticated' });

export const useExplorePersonal = () => useContext(Ctx);

/** Per-user data for otherwise static pages: fetched after hydration unless the server supplies `initial`. */
export function ExploreProvider({ initial, children }: { initial?: ExplorePersonal; children: ReactNode }) {
  const [data, setData] = useState<ExplorePersonal>(initial ?? EMPTY_EXPLORE_PERSONAL);
  const [ready, setReady] = useState(Boolean(initial));

  useEffect(() => {
    if (initial) return;
    const ctrl = new AbortController();
    fetch('/api/explore/me', { signal: ctrl.signal, credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.ok) setData(json as ExplorePersonal);
        setReady(true);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setReady(true);
      });
    return () => ctrl.abort();
  }, [initial]);

  const isSaved = useCallback((ref: string) => data.saved.includes(ref), [data.saved]);

  const toggleSaved = useCallback(
    async (ref: string): Promise<SavedFailure | null> => {
      const was = data.saved.includes(ref);
      const apply = (list: string[]) => setData((d) => ({ ...d, saved: list }));
      apply(was ? data.saved.filter((x) => x !== ref) : [...data.saved, ref]);
      try {
        const res = await fetch('/api/explore/saved', {
          method: was ? 'DELETE' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ref }),
          credentials: 'same-origin',
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) {
          apply(json.saved as string[]);
          return null;
        }
        apply(data.saved);
        const code = json?.error as SavedFailure | undefined;
        if (code === 'consent_required') setData((d) => ({ ...d, savedLocked: 'consent_required' }));
        return code ?? 'unavailable';
      } catch {
        apply(data.saved);
        return 'network';
      }
    },
    [data.saved],
  );

  const value = useMemo(() => ({ data, ready, isSaved, toggleSaved }), [data, ready, isSaved, toggleSaved]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
