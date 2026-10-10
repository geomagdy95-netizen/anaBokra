import { createAssessmentService, type AssessmentService } from '@/server/assessment/service';

import { LocalAssessmentRepo } from './assessment-repo';
import { DeviceStore, type LocalProfile } from './device';
import { deviceKv, type KvStore } from './kv';

/** The phase 1 counterpart of the server's AssessmentRuntime: the same service, backed by the device. */
export interface LocalRuntime {
  device: DeviceStore;
  profile: LocalProfile;
  userId: string;
  service: AssessmentService;
}

export function localRuntimeFor(kv: KvStore, profile: LocalProfile, now?: () => Date): LocalRuntime {
  const device = new DeviceStore(kv, now);
  const repo = new LocalAssessmentRepo(kv, profile.id, {
    // Read fresh each time: a withdrawal or a new confirmation takes effect immediately.
    hasConsent: async () => Boolean((await device.getProfile(profile.id))?.consent),
    now,
  });
  return { device, profile, userId: profile.id, service: createAssessmentService({ repo, now }) };
}

/** Opens the active profile on this device, or null when there is none yet (first start). */
export async function openLocalRuntime(): Promise<LocalRuntime | null> {
  const kv = await deviceKv();
  const device = new DeviceStore(kv);
  const id = await device.getActiveId();
  const profile = id ? await device.getProfile(id) : null;
  return profile ? localRuntimeFor(kv, profile) : null;
}
