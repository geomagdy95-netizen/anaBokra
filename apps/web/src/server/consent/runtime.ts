import 'server-only';

import { createHash } from 'node:crypto';

import { cookies, headers } from 'next/headers';

import { createClient, getUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/server/supabase-admin';

import { MemoryConsentRepo } from './memory-repo';
import { getConsentMessenger } from './messenger';
import { getMockConsentRepo, getMockOutbox, isConsentMock, mockIdFor, MOCK_PARENT_ID, MOCK_ROLE_COOKIE, MOCK_ROLES, type MockRole } from './mock';
import { createConsentService, type ConsentService } from './service';
import { SupabaseConsentRepo } from './supabase-repo';
import type { ConsentRepo } from './types';

export type ConsentRole = 'student' | 'parent' | 'school_admin' | 'other';

export interface ConsentRuntime {
  userId: string;
  role: ConsentRole;
  /** Verified E.164 phone of the signed-in user, when known. */
  phone: string | null;
  mock: boolean;
  service: ConsentService;
  origin: string;
}

/** Public origin for links sent over WhatsApp: NEXT_PUBLIC_SITE_URL, else the request's own origin. */
export async function resolveOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

function build(repo: ConsentRepo, origin: string, messenger = getConsentMessenger()): ConsentService {
  return createConsentService({
    repo,
    messenger,
    origin,
    maxResends: Number(process.env.CONSENT_MAX_RESENDS_PER_DAY) > 0 ? Number(process.env.CONSENT_MAX_RESENDS_PER_DAY) : undefined,
  });
}

/** Service for the guardian landing (no signed-in user needed). */
export async function getPublicConsentService(): Promise<ConsentService> {
  const origin = await resolveOrigin();
  return isConsentMock() ? build(getMockConsentRepo(), origin, getMockOutbox()) : build(new SupabaseConsentRepo(await createClient(), createAdminClient()), origin);
}

export async function mockRole(): Promise<MockRole> {
  const v = (await cookies()).get(MOCK_ROLE_COOKIE)?.value;
  return (MOCK_ROLES as readonly string[]).includes(v ?? '') ? (v as MockRole) : 'student';
}

/** Signed-in caller (or the mock persona). Null when nobody is signed in. */
export async function getConsentRuntime(): Promise<ConsentRuntime | null> {
  const origin = await resolveOrigin();
  if (isConsentMock()) {
    const role = await mockRole();
    const repo: MemoryConsentRepo = getMockConsentRepo();
    return { userId: mockIdFor(role), role, phone: role === 'parent' ? (repo.people.get(MOCK_PARENT_ID)?.phone ?? null) : null, mock: true, service: build(repo, origin, getMockOutbox()), origin };
  }
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const r = profile?.role;
  const role: ConsentRole = r === 'student' || r === 'parent' || r === 'school_admin' ? r : 'other';
  const phone = user.phone ? (user.phone.startsWith('+') ? user.phone : `+${user.phone}`) : null;
  return { userId: user.id, role, phone, mock: false, service: build(new SupabaseConsentRepo(supabase, createAdminClient()), origin), origin };
}

/** Salted hash of the client IP, stored in evidence ONLY when CONSENT_STORE_IP_HASH=1 (open legal question). */
export function ipHashFor(request: Request): string | undefined {
  if (process.env.CONSENT_STORE_IP_HASH !== '1') return undefined;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';
  if (!ip) return undefined;
  return createHash('sha256').update(`${process.env.CONSENT_IP_SALT ?? 'anabokra'}:${ip}`).digest('hex');
}
