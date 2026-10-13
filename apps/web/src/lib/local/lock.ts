import type { DeviceStore, LocalLock, LocalProfile } from './device';
import { hashPin, verifyPin } from './pin';

/**
 * Optional app lock (founder decision 13 Oct 2026): a password checked before a profile opens, with a
 * one-time recovery code to reset it. It locks the app; it doesn't encrypt anything (the data stays
 * encrypted with the device key, as before). Nothing here leaves the device, and the password is
 * never reused as an account password later.
 *
 * Unlocking lasts until the tab or app is closed (sessionStorage), or until "Lock now".
 */

export const MIN_PASSWORD = 6;
const MAX_PASSWORD = 128;
/** After this many wrong tries in a row comes a 30-second wait; each further wrong try doubles it, up to 15 minutes. */
export const FREE_TRIES = 5;
const FIRST_WAIT_MS = 30_000;
const MAX_WAIT_MS = 15 * 60_000;

/** No 0/O, 1/I/L: easy to copy by hand. 12 characters from 31 ≈ 59 bits. */
const RECOVERY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const toAsciiDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** The same password typed with Arabic or Latin digits, or with a stray space at either end, matches. */
export const normalizePassword = (s: string) => toAsciiDigits(s.normalize('NFC')).trim();

export const isValidPassword = (s: string) => {
  const n = normalizePassword(s);
  return n.length >= MIN_PASSWORD && n.length <= MAX_PASSWORD;
};

/** Upper-case, Latin digits, letters and digits only: dashes and spaces don't matter. */
export const normalizeRecovery = (s: string) => toAsciiDigits(s.normalize('NFC')).toUpperCase().replace(/[^A-Z0-9]/g, '');

export function newRecoveryCode(): string {
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % RECOVERY_ALPHABET.length);
  let chars = '';
  while (chars.length < 12)
    for (const b of crypto.getRandomValues(new Uint8Array(16))) if (b < limit && chars.length < 12) chars += RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length];
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

// ---- Unlocked for this tab ----

const SESSION_KEY = 'anabokra:unlocked';
let unlockedId: string | null = null;

function remember(id: string | null) {
  unlockedId = id;
  try {
    if (id) sessionStorage.setItem(SESSION_KEY, id);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // No sessionStorage (tests, blocked storage): the in-memory flag still works for this page.
  }
}

function isUnlocked(id: string): boolean {
  if (unlockedId === id) return true;
  try {
    return sessionStorage.getItem(SESSION_KEY) === id;
  } catch {
    return false;
  }
}

/** True when the profile has a password and hasn't been unlocked in this tab. */
export const needsUnlock = (profile: Pick<LocalProfile, 'id' | 'lock'>) => Boolean(profile.lock) && !isUnlocked(profile.id);

/** "Lock now", and after deleting or switching profiles. */
export const lockNow = () => remember(null);

// ---- Setting, checking and resetting ----

/** Sets or replaces the password and returns a new recovery code to show once. Unlocks this tab. */
export async function setPassword(device: DeviceStore, profileId: string, password: string, now = new Date()): Promise<string> {
  if (!isValidPassword(password)) throw new Error('invalid_password');
  const recovery = newRecoveryCode();
  const lock: LocalLock = {
    password: await hashPin(normalizePassword(password)),
    recovery: await hashPin(normalizeRecovery(recovery)),
    setAt: now.toISOString(),
    failed: 0,
    retryAt: null,
  };
  await device.updateProfile(profileId, { lock });
  remember(profileId);
  return recovery;
}

export async function removePassword(device: DeviceStore, profileId: string): Promise<void> {
  await device.updateProfile(profileId, { lock: null });
}

export type CheckResult = { ok: true } | { ok: false; reason: 'wrong' } | { ok: false; reason: 'wait'; retryAt: string };

/** Checks the password or recovery code against the stored hash, counting wrong tries on the device. */
async function check(device: DeviceStore, profileId: string, kind: 'password' | 'recovery', secret: string, now: Date): Promise<CheckResult> {
  const profile = await device.getProfile(profileId);
  if (!profile?.lock) return { ok: true };
  const { lock } = profile;
  if (lock.retryAt && new Date(lock.retryAt) > now) return { ok: false, reason: 'wait', retryAt: lock.retryAt };

  const value = kind === 'password' ? normalizePassword(secret) : normalizeRecovery(secret);
  if (value && (await verifyPin(value, lock[kind]))) {
    await device.updateProfile(profileId, { lock: { ...lock, failed: 0, retryAt: null } });
    return { ok: true };
  }

  const failed = lock.failed + 1;
  const over = failed - FREE_TRIES + 1;
  const retryAt = over > 0 ? new Date(now.getTime() + Math.min(FIRST_WAIT_MS * 2 ** (over - 1), MAX_WAIT_MS)).toISOString() : null;
  await device.updateProfile(profileId, { lock: { ...lock, failed, retryAt } });
  return retryAt ? { ok: false, reason: 'wait', retryAt } : { ok: false, reason: 'wrong' };
}

/** Unlocks this tab when the password is right. */
export async function unlock(device: DeviceStore, profileId: string, password: string, now = new Date()): Promise<CheckResult> {
  const r = await check(device, profileId, 'password', password, now);
  if (r.ok) remember(profileId);
  return r;
}

/** Checks the current password without unlocking (changing or removing it in Settings). */
export const checkPassword = (device: DeviceStore, profileId: string, password: string, now = new Date()) =>
  check(device, profileId, 'password', password, now);

/**
 * "Forgot my password": a right recovery code sets the new password (and returns its new recovery
 * code), or removes the password when `newPassword` is null. The old code stops working either way.
 */
export async function resetWithRecovery(
  device: DeviceStore,
  profileId: string,
  code: string,
  newPassword: string | null,
  now = new Date(),
): Promise<CheckResult & { recovery?: string }> {
  if (newPassword !== null && !isValidPassword(newPassword)) throw new Error('invalid_password');
  const r = await check(device, profileId, 'recovery', code, now);
  if (!r.ok) return r;
  if (newPassword === null) {
    await removePassword(device, profileId);
    remember(profileId);
    return { ok: true };
  }
  return { ok: true, recovery: await setPassword(device, profileId, newPassword, now) };
}
