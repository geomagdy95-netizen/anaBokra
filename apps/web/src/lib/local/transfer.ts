import { assessmentKey } from './assessment-repo';
import { DeviceStore, type LocalProfile } from './device';
import type { KvStore } from './kv';

/**
 * Moving a profile to another phone (consent-texts §1.5). The data is sealed on this device with
 * AES-256-GCM before it goes anywhere:
 * - backup file: the key comes from a passphrase the user chooses (PBKDF2);
 * - transfer code: the key is random, shown to the user, and never sent to the server, which only
 *   relays the sealed bytes.
 */

export interface ProfileBundle {
  v: 1;
  exportedAt: string;
  profile: LocalProfile;
  assessment: unknown;
  /** What was already sent (statistics, research) and the research link code, so nothing is sent twice. */
  sent?: { stats?: unknown; research?: unknown };
  /** Verify answers and path results (lib/journey/verify.ts). */
  journey?: unknown;
}

export interface SealedBundle {
  format: 'anabokra-backup' | 'anabokra-transfer';
  v: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string } | { name: 'HKDF'; hash: 'SHA-256'; salt: string };
  iv: string;
  data: string;
}

export class BundleError extends Error {
  constructor(readonly code: 'wrong_secret' | 'not_a_backup' | 'unsupported_version') {
    super(code);
  }
}

// --- encoding ------------------------------------------------------------------

export function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const b = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Crockford base32: no I, L, O or U, so codes are easy to read aloud and type. */
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function randomCode(chars: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(chars));
  return [...bytes].map((b) => B32[b & 31]).join('');
}

/** Upper-cases and maps look-alikes (O→0, I/L→1), dropping spaces and dashes. */
export function normalizeCode(s: string): string {
  return s
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

/** "ABCDEFGH" → "ABCD-EFGH" for display. */
export const groupCode = (s: string) => s.match(/.{1,4}/g)?.join('-') ?? s;

function codeBytes(code: string): Uint8Array<ArrayBuffer> {
  const n = normalizeCode(code);
  return new Uint8Array([...n].map((c) => B32.indexOf(c)));
}

// --- keys ----------------------------------------------------------------------

const PBKDF2_ITERATIONS = 310_000;

async function passphraseKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function transferKey(key: string, salt: Uint8Array<ArrayBuffer>) {
  const base = await crypto.subtle.importKey('raw', codeBytes(key), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('anabokra-transfer-v1') },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function seal(bundle: ProfileBundle, key: CryptoKey, format: SealedBundle['format'], kdf: SealedBundle['kdf']): Promise<SealedBundle> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(bundle)));
  return { format, v: 1, kdf, iv: toBase64(iv), data: toBase64(data) };
}

async function open(sealed: SealedBundle, key: CryptoKey): Promise<ProfileBundle> {
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(sealed.iv) }, key, fromBase64(sealed.data));
  } catch {
    throw new BundleError('wrong_secret');
  }
  const bundle = JSON.parse(new TextDecoder().decode(plain)) as ProfileBundle;
  if (bundle.v !== 1) throw new BundleError('unsupported_version');
  return bundle;
}

export function parseSealed(text: string): SealedBundle {
  let s: SealedBundle;
  try {
    s = JSON.parse(text) as SealedBundle;
  } catch {
    throw new BundleError('not_a_backup');
  }
  if ((s?.format !== 'anabokra-backup' && s?.format !== 'anabokra-transfer') || typeof s.iv !== 'string' || typeof s.data !== 'string') throw new BundleError('not_a_backup');
  if (s.v !== 1) throw new BundleError('unsupported_version');
  return s;
}

/** Backup file sealed with a passphrase. */
export async function sealWithPassphrase(bundle: ProfileBundle, passphrase: string, iterations = PBKDF2_ITERATIONS): Promise<SealedBundle> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return seal(bundle, await passphraseKey(passphrase, salt, iterations), 'anabokra-backup', { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(salt) });
}

export async function openWithPassphrase(sealed: SealedBundle, passphrase: string): Promise<ProfileBundle> {
  if (sealed.kdf.name !== 'PBKDF2') throw new BundleError('not_a_backup');
  return open(sealed, await passphraseKey(passphrase, fromBase64(sealed.kdf.salt), sealed.kdf.iterations));
}

/** Transfer: a fresh random 16-character key (80 bits). Only the sealed bytes go to the relay. */
export async function sealForTransfer(bundle: ProfileBundle): Promise<{ sealed: SealedBundle; key: string }> {
  const key = randomCode(16);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const sealed = await seal(bundle, await transferKey(key, salt), 'anabokra-transfer', { name: 'HKDF', hash: 'SHA-256', salt: toBase64(salt) });
  return { sealed, key };
}

export async function openTransfer(sealed: SealedBundle, key: string): Promise<ProfileBundle> {
  if (sealed.kdf.name !== 'HKDF') throw new BundleError('not_a_backup');
  return open(sealed, await transferKey(key, fromBase64(sealed.kdf.salt)));
}

// --- device ----------------------------------------------------------------------

export async function exportProfile(kv: KvStore, profileId: string, now: () => Date = () => new Date()): Promise<ProfileBundle> {
  const stored = await new DeviceStore(kv).getProfile(profileId);
  if (!stored) throw new Error('profile_not_found');
  // The app lock belongs to this phone, not to the data: a backup is already locked by its passphrase,
  // and a forgotten app password must not come back with the restore.
  const profile = { ...stored, lock: null };
  const [stats, research, journey] = await Promise.all([kv.get(`stats:${profileId}`), kv.get(`research:${profileId}`), kv.get(`journey:${profileId}`)]);
  return {
    v: 1,
    exportedAt: now().toISOString(),
    profile,
    assessment: (await kv.get(assessmentKey(profileId))) ?? null,
    sent: { ...(stats ? { stats } : {}), ...(research ? { research } : {}) },
    ...(journey ? { journey } : {}),
  };
}

/**
 * Restores a bundle as this device's profile, keeping its id (sessions and results refer to it).
 * Whatever profile was active here is replaced. Any app lock is dropped (set a new one on this phone).
 */
export async function importProfile(kv: KvStore, bundle: ProfileBundle): Promise<LocalProfile> {
  const device = new DeviceStore(kv);
  const current = await device.getActiveId();
  if (current && current !== bundle.profile.id) await device.deleteProfile(current);
  await kv.set(`profile:${bundle.profile.id}`, { ...bundle.profile, lock: null });
  if (bundle.assessment) await kv.set(assessmentKey(bundle.profile.id), bundle.assessment);
  else await kv.delete(assessmentKey(bundle.profile.id));
  if (bundle.journey) await kv.set(`journey:${bundle.profile.id}`, bundle.journey);
  else await kv.delete(`journey:${bundle.profile.id}`);
  for (const k of ['stats', 'research'] as const) {
    const v = bundle.sent?.[k];
    if (v) await kv.set(`${k}:${bundle.profile.id}`, v);
    else await kv.delete(`${k}:${bundle.profile.id}`);
  }
  await device.setActiveId(bundle.profile.id);
  return { ...bundle.profile, lock: null };
}
