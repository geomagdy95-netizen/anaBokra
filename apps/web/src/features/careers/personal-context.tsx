'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { EMPTY_PERSONAL, type PersonalData } from './types';

export type FavoriteFailure = 'unauthenticated' | 'consent_required' | 'not_found' | 'unavailable' | 'network';

interface PersonalContextValue {
  data: PersonalData;
  /** False until /api/careers/me answered (or the server supplied the data). */
  ready: boolean;
  isFavorite(id: string): boolean;
  /** Optimistic; resolves to null on success or the failure code (state is rolled back). */
  toggleFavorite(id: string): Promise<FavoriteFailure | null>;
}

const PersonalContext = createContext<PersonalContextValue>({
  data: EMPTY_PERSONAL,
  ready: false,
  isFavorite: () => false,
  toggleFavorite: async () => 'unauthenticated',
});

export const usePersonal = () => useContext(PersonalContext);

/**
 * Per-user data (fit %, favorites) for otherwise static pages. Pass `initial` when the server already
 * knows it (favorites, compare); without it the provider fetches /api/careers/me after hydration so
 * the page itself stays statically generated.
 */
export function PersonalProvider({ initial, children }: { initial?: PersonalData; children: ReactNode }) {
  const [data, setData] = useState<PersonalData>(initial ?? EMPTY_PERSONAL);
  const [ready, setReady] = useState(Boolean(initial));

  useEffect(() => {
    if (initial) return;
    const ctrl = new AbortController();
    fetch('/api/careers/me', { signal: ctrl.signal, credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.ok) setData(json as PersonalData);
        setReady(true);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setReady(true);
      });
    return () => ctrl.abort();
  }, [initial]);

  const isFavorite = useCallback((id: string) => data.favorites.includes(id), [data.favorites]);

  const toggleFavorite = useCallback(
    async (id: string): Promise<FavoriteFailure | null> => {
      const was = data.favorites.includes(id);
      const apply = (list: string[]) => setData((d) => ({ ...d, favorites: list }));
      apply(was ? data.favorites.filter((x) => x !== id) : [...data.favorites, id]);
      try {
        const res = await fetch('/api/careers/favorites', {
          method: was ? 'DELETE' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ careerId: id }),
          credentials: 'same-origin',
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) {
          apply(json.favorites as string[]);
          return null;
        }
        apply(data.favorites);
        const code = json?.error as FavoriteFailure | undefined;
        if (code === 'consent_required') setData((d) => ({ ...d, favoritesLocked: 'consent_required' }));
        return code ?? 'unavailable';
      } catch {
        apply(data.favorites);
        return 'network';
      }
    },
    [data.favorites],
  );

  const value = useMemo(() => ({ data, ready, isFavorite, toggleFavorite }), [data, ready, isFavorite, toggleFavorite]);
  return <PersonalContext.Provider value={value}>{children}</PersonalContext.Provider>;
}
