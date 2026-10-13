import { createAssessmentService, type AssessmentService } from '@/server/assessment/service';

import { LocalAssessmentRepo } from './assessment-repo';
import { DeviceStore, type LocalProfile } from './device';
import { deviceKv, type KvStore } from './kv';
import { lockNow, needsUnlock } from './lock';

/** The phase 1 counterpart of the server's AssessmentRuntime: the same service, backed by the device. */
export interface LocalRuntime {
  device: DeviceStore;
  profile: LocalProfile;
  userId: string;
  service: AssessmentService;
  /** The on-device store behind the service (for reading what to upload, never for writing). */
  repo: LocalAssessmentRepo;
}

export function localRuntimeFor(kv: KvStore, profile: LocalProfile, now?: () => Date): LocalRuntime {
  const device = new DeviceStore(kv, now);
  const repo = new LocalAssessmentRepo(kv, profile.id, {
    // Read fresh each time: a withdrawal or a new confirmation takes effect immediately.
    hasConsent: async () => Boolean((await device.getProfile(profile.id))?.consent),
    now,
  });
  return { device, profile, userId: profile.id, service: createAssessmentService({ repo, now }), repo };
}

/** Opens the active profile on this device, or null when there is none yet (first start) or it's locked. */
export async function openLocalRuntime(): Promise<LocalRuntime | null> {
  const kv = await deviceKv();
  const device = new DeviceStore(kv);
  const id = await device.getActiveId();
  const profile = id ? await device.getProfile(id) : null;
  return profile && !needsUnlock(profile) ? localRuntimeFor(kv, profile) : null;
}

/** The active profile when it has a password and this tab hasn't unlocked it yet; otherwise null. */
export async function lockedProfile(): Promise<LocalProfile | null> {
  const device = new DeviceStore(await deviceKv());
  const id = await device.getActiveId();
  const profile = id ? await device.getProfile(id) : null;
  return profile && needsUnlock(profile) ? profile : null;
}

let active: { id: string; rt: LocalRuntime } | null = null;

/**
 * The active profile's runtime, shared by every screen. One repo instance per profile keeps writes
 * in order; the profile record is re-read so name, gender or consent changes show up.
 */
export async function activeRuntime(): Promise<LocalRuntime | null> {
  const kv = await deviceKv();
  const device = new DeviceStore(kv);
  const id = await device.getActiveId();
  const profile = id ? await device.getProfile(id) : null;
  // A locked profile reads as no runtime: no screen can read its data until it's unlocked.
  if (!profile || needsUnlock(profile)) {
    active = null;
    return null;
  }
  if (active?.id !== profile.id) active = { id: profile.id, rt: localRuntimeFor(kv, profile) };
  active.rt = { ...active.rt, profile };
  return active.rt;
}

/** Call after deleting or switching profiles. */
export function forgetActiveRuntime() {
  active = null;
}

/** "Lock now": forget the runtime and require the password again. */
export function lockActiveProfile() {
  lockNow();
  active = null;
}
