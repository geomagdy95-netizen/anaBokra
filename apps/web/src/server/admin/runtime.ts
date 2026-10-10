import 'server-only';

import { notFound } from 'next/navigation';

import { getUser } from '@/lib/supabase/server';
import { isMockMode, MOCK_USER_ID } from '@/server/assessment/mock';
import { createAdminClient } from '@/server/supabase-admin';

import { MemoryAdminRepo } from './memory-repo';
import { SupabaseAdminRepo } from './supabase-repo';
import { canOpen, type AdminRepo, type AdminRole, type AdminSection } from './types';

export interface AdminContext {
  userId: string;
  roles: AdminRole[];
  repo: AdminRepo;
}

const g = globalThis as unknown as { __anabokraAdminDemo?: MemoryAdminRepo };

/** Demo repo for dev mock mode, kept across hot reloads. */
function demoRepo(): MemoryAdminRepo {
  return (g.__anabokraAdminDemo ??= new MemoryAdminRepo());
}

/**
 * The signed-in caller with at least one active admin role, or null. In dev mock mode
 * (ASSESSMENT_REPO=memory, never in production) the mock user is a super_admin over demo data.
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  if (isMockMode()) {
    const repo = demoRepo();
    return { userId: MOCK_USER_ID, roles: await repo.getAdminRoles(), repo };
  }
  const user = await getUser();
  if (!user) return null;
  const repo = new SupabaseAdminRepo(createAdminClient());
  const roles = await repo.getAdminRoles(user.id);
  return roles.length ? { userId: user.id, roles, repo } : null;
}

/** For pages: 404 (not 403) for anyone without access, so the back office isn't advertised. */
export async function requireAdmin(section: AdminSection): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx || !canOpen(ctx.roles, section)) notFound();
  return ctx;
}

/** For route handlers: the context, or null when the caller may not use this section. */
export async function adminFor(section: AdminSection): Promise<AdminContext | null> {
  const ctx = await getAdminContext();
  return ctx && canOpen(ctx.roles, section) ? ctx : null;
}
