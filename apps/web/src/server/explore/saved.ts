import { parseRef } from '@/features/explore/saved-ref';
import { createClient, getUser } from '@/lib/supabase/server';
import { isMockMode, MOCK_USER_ID } from '@/server/assessment/mock';

export type SavedStoreFailure = 'unauthenticated' | 'consent_required' | 'not_found' | 'unavailable';
export type SavedResult<T> = { ok: true; value: T } | { ok: false; code: SavedStoreFailure };

export interface SavedStore {
  /** "kind:id" refs, oldest first. */
  list(): Promise<string[]>;
  add(ref: string): Promise<void>;
  remove(ref: string): Promise<void>;
}

export class SavedError extends Error {
  constructor(readonly code: Exclude<SavedStoreFailure, 'unauthenticated'>) {
    super(code);
  }
}

// ---------------------------------------------------------------- in-memory (mock mode and tests)

const KEY = Symbol.for('anabokra.explore.saved');
type Holder = typeof globalThis & { [KEY]?: Map<string, string[]> };

export function memorySavedStore(userId: string, backing?: Map<string, string[]>): SavedStore {
  const map = backing ?? ((globalThis as Holder)[KEY] ??= new Map());
  const mine = (): string[] => map.get(userId) ?? [];
  return {
    async list() {
      return [...mine()];
    },
    async add(ref) {
      if (!mine().includes(ref)) map.set(userId, [...mine(), ref]);
    },
    async remove(ref) {
      map.set(
        userId,
        mine().filter((x) => x !== ref),
      );
    },
  };
}

// ---------------------------------------------------------------- Supabase

/** The engagement consent gate raises 42501 "consent_required"; an FK miss is "not_found". */
export function mapSavedError(error: { code?: string; message?: string }): SavedError {
  const msg = error.message ?? '';
  if (error.code === '42501' || msg.includes('consent_required')) return new SavedError('consent_required');
  if (error.code === '23503') return new SavedError('not_found');
  return new SavedError('unavailable');
}

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

const split = (ref: string) => {
  const p = parseRef(ref);
  if (!p) throw new SavedError('not_found');
  return p;
};

/** Rows are keyed (user_id, item_kind, item_id) with the content slug as item_id; refs are "kind:id". */
export function supabaseSavedStore(supabase: SupabaseLike, userId: string): SavedStore {
  return {
    async list() {
      const { data, error } = await supabase
        .from('saved_opportunities')
        .select('item_kind, item_id')
        .eq('user_id', userId)
        .in('item_kind', ['program', 'university', 'provider'])
        .neq('status', 'dismissed')
        .order('created_at', { ascending: true });
      if (error) throw mapSavedError(error);
      return (data ?? []).map((r) => `${r.item_kind}:${r.item_id}`);
    },
    async add(ref) {
      const { kind, id } = split(ref);
      const { error } = await supabase
        .from('saved_opportunities')
        .upsert({ user_id: userId, item_kind: kind, item_id: id, status: 'saved' }, { onConflict: 'user_id,item_kind,item_id' });
      if (error) throw mapSavedError(error);
    },
    async remove(ref) {
      const { kind, id } = split(ref);
      const { error } = await supabase.from('saved_opportunities').delete().eq('user_id', userId).eq('item_kind', kind).eq('item_id', id);
      if (error) throw mapSavedError(error);
    },
  };
}

export async function getSavedStore(): Promise<SavedStore | null> {
  if (isMockMode()) return memorySavedStore(MOCK_USER_ID);
  try {
    const user = await getUser();
    if (!user) return null;
    return supabaseSavedStore(await createClient(), user.id);
  } catch {
    return null;
  }
}

export async function withSaved<T>(run: (store: SavedStore) => Promise<T>): Promise<SavedResult<T>> {
  const store = await getSavedStore();
  if (!store) return { ok: false, code: 'unauthenticated' };
  try {
    return { ok: true, value: await run(store) };
  } catch (e) {
    return { ok: false, code: e instanceof SavedError ? e.code : 'unavailable' };
  }
}
