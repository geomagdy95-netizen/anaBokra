import type { User } from '@supabase/supabase-js';

import { createAdminClient } from '../supabase-admin';
import type { SelfServiceRole } from './roles';

/** A user created this recently may still pick their role (OAuth cannot carry it through signup). */
const ROLE_CHOICE_WINDOW_MS = 15 * 60 * 1000;

const toE164 = (phone: string | undefined): string | null => {
  if (!phone) return null;
  const p = phone.startsWith('+') ? phone : `+${phone}`;
  return /^\+[1-9][0-9]{7,14}$/.test(p) ? p : null;
};

/**
 * First-login profile bootstrap. The `handle_new_user` DB trigger already inserts the profile
 * (role taken from signup metadata). This guarantees the row exists (idempotent), applies the
 * chosen role for brand-new accounts that could not pass it at signup (Google), and stores the
 * verified phone. Returning users' roles are never changed here (profiles.role is locked).
 */
export async function ensureProfile(user: User, role: SelfServiceRole, locale: 'ar' | 'en', now = Date.now()) {
  const admin = createAdminClient();
  const phone = toE164(user.phone);

  const { data: existing, error } = await admin.from('profiles').select('id, role, phone').eq('id', user.id).maybeSingle();
  if (error) throw error;

  if (!existing) {
    const name = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? '') as string;
    const { error: insertError } = await admin
      .from('profiles')
      .insert({ id: user.id, role, display_name: name.slice(0, 100), locale, phone });
    if (insertError) throw insertError;
    return { role, created: true };
  }

  const patch: Record<string, unknown> = {};
  const isNew = now - new Date(user.created_at).getTime() < ROLE_CHOICE_WINDOW_MS;
  if (isNew && (existing.role === 'student' || existing.role === 'parent') && existing.role !== role) patch.role = role;
  if (phone && !existing.phone) patch.phone = phone;
  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await admin.from('profiles').update(patch).eq('id', user.id);
    if (updateError) throw updateError;
  }
  return { role: (patch.role as string | undefined) ?? existing.role, created: false };
}
