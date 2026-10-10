import { createClient, getUser } from '@/lib/supabase/server';
import { isMockMode, MOCK_USER_ID } from '@/server/assessment/mock';

export type FavoritesFailure = 'unauthenticated' | 'consent_required' | 'not_found' | 'unavailable';
export type FavoritesResult<T> = { ok: true; value: T } | { ok: false; code: FavoritesFailure };

export interface FavoritesStore {
  list(): Promise<string[]>;
  add(careerId: string): Promise<void>;
  remove(careerId: string): Promise<void>;
}

/** Thrown by stores; mapped to a FavoritesFailure by `withFavorites`. */
export class FavoritesError extends Error {
  constructor(readonly code: Exclude<FavoritesFailure, 'unauthenticated'>) {
    super(code);
  }
}

// ---------------------------------------------------------------- in-memory (dev mock mode and tests)

const KEY = Symbol.for('anabokra.careers.favorites');
type Holder = typeof globalThis & { [KEY]?: Map<string, string[]> };

/** Per-process favorites, ordered by when they were added. */
export function memoryFavoritesStore(userId: string, backing?: Map<string, string[]>): FavoritesStore {
  const map = backing ?? ((globalThis as Holder)[KEY] ??= new Map());
  const mine = (): string[] => map.get(userId) ?? [];
  return {
    async list() {
      return [...mine()];
    },
    async add(id) {
      if (!mine().includes(id)) map.set(userId, [...mine(), id]);
    },
    async remove(id) {
      map.set(
        userId,
        mine().filter((x) => x !== id),
      );
    },
  };
}

// ---------------------------------------------------------------- Supabase

interface PgErrorLike {
  code?: string;
  message?: string;
}

/** Maps a Supabase/PostgREST error: the engagement consent gate raises 42501 "consent_required". */
export function mapFavoritesError(error: PgErrorLike): FavoritesError {
  const msg = error.message ?? '';
  if (error.code === '42501' || msg.includes('consent_required')) return new FavoritesError('consent_required');
  if (error.code === '23503') return new FavoritesError('not_found');
  return new FavoritesError('unavailable');
}

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

export function supabaseFavoritesStore(supabase: SupabaseLike, userId: string): FavoritesStore {
  return {
    async list() {
      const { data, error } = await supabase
        .from('favorites')
        .select('career_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) throw mapFavoritesError(error);
      return (data ?? []).map((r) => r.career_id as string);
    },
    async add(id) {
      const { error } = await supabase.from('favorites').upsert({ user_id: userId, career_id: id }, { onConflict: 'user_id,career_id', ignoreDuplicates: true });
      if (error) throw mapFavoritesError(error);
    },
    async remove(id) {
      const { error } = await supabase.from('favorites').delete().eq('user_id', userId).eq('career_id', id);
      if (error) throw mapFavoritesError(error);
    },
  };
}

// ---------------------------------------------------------------- entry point

/** Store for the current caller: mock memory store in dev mock mode, else the signed-in user's Supabase rows. */
export async function getFavoritesStore(): Promise<FavoritesStore | null> {
  if (isMockMode()) return memoryFavoritesStore(MOCK_USER_ID);
  try {
    const user = await getUser();
    if (!user) return null;
    return supabaseFavoritesStore(await createClient(), user.id);
  } catch {
    return null;
  }
}

/** Runs an operation against the caller's store and turns failures into a typed result (never throws). */
export async function withFavorites<T>(run: (store: FavoritesStore) => Promise<T>): Promise<FavoritesResult<T>> {
  const store = await getFavoritesStore();
  if (!store) return { ok: false, code: 'unauthenticated' };
  try {
    return { ok: true, value: await run(store) };
  } catch (e) {
    return { ok: false, code: e instanceof FavoritesError ? e.code : 'unavailable' };
  }
}
