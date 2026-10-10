import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 * Acts as the signed-in user (RLS applies). In Server Components cookie writes are
 * ignored; the proxy refreshes the session so that is fine.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy keeps the session fresh.
        }
      },
    },
  });
}

/** The verified signed-in user (revalidated with the Auth server) or null. */
export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
