import type { KvStore } from './kv';
import type { PinHash } from './pin';

/**
 * Profiles that live on this device. A phone has one profile (its owner); a shared device (a loaner
 * at a pilot session) may hold several in turn. Nothing here leaves the device.
 */
export type DeviceMode = 'phone' | 'shared';

/**
 * Why this profile may take the assessment (consent-texts.en.md §1): an adult (18+) or a 15–17-year-old
 * accepted for themselves. Phase 1 has no parent step: no personal data reaches anaBokra (counsel
 * agreed, 13 Oct 2026).
 */
export type ConsentBasis = 'adult_self' | 'teen_self';

export interface DeviceConsent {
  basis: ConsentBasis;
  confirmedAt: string;
  textVersion: string;
  policyVersion: string;
  /** Opt-in to anonymous statistics (§1.6), chosen by the user. */
  stats?: boolean;
  /** Opt-in to research data at university sessions (§2.3, adults only), and when it was given. */
  research?: boolean;
  researchConfirmedAt?: string;
}

/** The university pilot session this profile joined (§2.2), as the server confirmed it. */
export interface JoinedEvent {
  code: string;
  /** Whether that partner offers the research opt-in. */
  research: boolean;
  joinedAt: string;
}

/**
 * Optional app lock (lib/local/lock.ts): salted PBKDF2 hashes of the password and its recovery code,
 * and wrong tries counted on the device. On the device only, encrypted with everything else.
 */
export interface LocalLock {
  password: PinHash;
  recovery: PinHash;
  setAt: string;
  failed: number;
  /** No more tries before this time (after too many wrong ones). */
  retryAt: string | null;
}

/** 18–20 is kept apart from 21+ because the Civil Code puts full capacity at 21 (open legal question). */
export type AgeBand = 'under15' | '15-17' | '18-20' | '21-25' | '26plus';

export interface LocalProfile {
  id: string;
  mode: DeviceMode;
  /** Nickname chosen at first start; stays on the device (never in statistics or research data). */
  displayName: string | null;
  grade: number | null;
  track: string | null;
  gender: 'female' | 'male' | null;
  governorate: string | null;
  locale: 'ar' | 'en';
  ageBand: AgeBand | null;
  consent: DeviceConsent | null;
  /** Pilot session, if one was joined. Optional: profiles made before sessions existed lack it. */
  event?: JoinedEvent | null;
  /** App lock, if the user set a password. Optional: older profiles lack it. */
  lock?: LocalLock | null;
  createdAt: string;
}

export type NewProfile = Partial<Omit<LocalProfile, 'id' | 'createdAt'>> & Pick<LocalProfile, 'mode'>;

const PROFILE = (id: string) => `profile:${id}`;
const ACTIVE = 'active-profile';
/** Every key holding one profile's data starts with one of these. */
export const PROFILE_SCOPED_PREFIXES = ['profile:', 'assessment:', 'stats:', 'research:', 'journey:'] as const;

export class DeviceStore {
  constructor(
    readonly kv: KvStore,
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
      grade: null,
      track: null,
      gender: null,
      governorate: null,
      locale: 'ar',
      ageBand: null,
      consent: null,
      event: null,
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

  /** Removes everything on this device and discards its encryption key. */
  async wipeAll(): Promise<void> {
    await this.kv.clear();
    const { forgetDeviceKey } = await import('./kv');
    await forgetDeviceKey();
  }
}
