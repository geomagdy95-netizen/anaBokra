import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { requireEnv } from './env';

/**
 * Service-role client: bypasses RLS. Server-only (route handlers / server actions),
 * never import it into a client component. Use for trusted server-owned writes.
 */
export function createAdminClient() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
