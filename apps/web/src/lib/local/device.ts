import type { KvStore } from './kv';

/**
 * Profiles that live on this device. Phone mode has one profile (the owner); tablet mode (school
 * pilot) holds several, each opened with a student ID + PIN. Nothing here leaves the device.
 */
export type DeviceMode = 'phone' | 'tablet';

/** Why this profile may take the assessment (consent-texts.en.md, phase 1). */
export type ConsentBasis = 'guardian_on_device' | 'adult_self' | 'school_form';

export interface DeviceConsent {
  basis: ConsentBasis;
  confirmedAt: string;
  textVersion: string;
  policyVersion: string;
  /** School pilot: the parent's optional choices from the paper form. */
  research?: boolean;
  counselorCopy?: boolean;
}

export type AgeBand = 'under15' | '15-17' | '18plus';

export interface LocalProfile {
  id: string;
  mode: DeviceMode;
  displayName: string | null;
  /** School pilot only: the random student ID handed out by the school. */
  studentCode: string | null;
  grade: number | null;
  track: string | null;
  gender: 'female' | 'male' | null;
  governorate: string | null;
  locale: 'ar' | 'en';
  ageBand: AgeBand | null;
  consent: DeviceConsent | null;
  createdAt: string;
}

export type NewProfile = Partial<Omit<LocalProfile, 'id' | 'createdAt'>> & Pick<LocalProfile, 'mode'>;

const PROFILE = (id: string) => `profile:${id}`;
const ACTIVE = 'active-profile';
/** Every key holding one profile's data starts with one of these. */
export const PROFILE_SCOPED_PREFIXES = ['profile:', 'assessment:'] as const;

export class DeviceStore {
  constructor(
    private readonly kv: KvStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get persistent() {
    return this.kv.persistent;
  }

  async listProfiles(): Promise<LocalProfile[]> {
    const keys = await this.kv.keys('profile:');
    const all = await Promise.all(keys.map((k) => this.kv.get<LocalProfile>(k)));
    return all.filter((p): p is LocalProfile => Boolean(p)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getProfile(id: string): Promise<LocalProfile | null> {
    return (await this.kv.get<LocalProfile>(PROFILE(id))) ?? null;
  }

  async createProfile(input: NewProfile): Promise<LocalProfile> {
    const p: LocalProfile = {
      displayName: null,
      studentCode: null,
      grade: null,
      track: null,
      gender: null,
      governorate: null,
      locale: 'ar',
      ageBand: null,
      consent: null,
      ...input,
      id: crypto.randomUUID(),
      createdAt: this.now().toISOString(),
    };
    await this.kv.set(PROFILE(p.id), p);
    return p;
  }

  async updateProfile(id: string, patch: Partial<Omit<LocalProfile, 'id' | 'createdAt' | 'mode'>>): Promise<LocalProfile> {
    const p = await this.getProfile(id);
    if (!p) throw new Error('profile_not_found');
    const next = { ...p, ...patch };
    await this.kv.set(PROFILE(id), next);
    return next;
  }

  async setConsent(id: string, consent: Omit<DeviceConsent, 'confirmedAt'>): Promise<LocalProfile> {
    return this.updateProfile(id, { consent: { ...consent, confirmedAt: this.now().toISOString() } });
  }

  async getActiveId(): Promise<string | null> {
    return (await this.kv.get<string>(ACTIVE)) ?? null;
  }

  async setActiveId(id: string | null): Promise<void> {
    if (id) await this.kv.set(ACTIVE, id);
    else await this.kv.delete(ACTIVE);
  }

  /** Removes one profile and everything stored for it (withdrawal, or "delete all my data" on a phone). */
  async deleteProfile(id: string): Promise<void> {
    await Promise.all(PROFILE_SCOPED_PREFIXES.map((prefix) => this.kv.delete(`${prefix}${id}`)));
    if ((await this.getActiveId()) === id) await this.setActiveId(null);
  }

  /** Removes everything on this device (end of the pilot, or a reset). */
  async wipeAll(): Promise<void> {
    await this.kv.clear();
  }
}
