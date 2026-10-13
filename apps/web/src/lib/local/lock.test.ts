import { beforeEach, describe, expect, it } from 'vitest';

import { DeviceStore } from './device';
import { MemoryKv } from './kv';
import {
  FREE_TRIES,
  checkPassword,
  isValidPassword,
  lockNow,
  needsUnlock,
  newRecoveryCode,
  normalizePassword,
  normalizeRecovery,
  removePassword,
  resetWithRecovery,
  setPassword,
  unlock,
} from './lock';
import { lockedProfile } from './runtime';

const T0 = new Date('2026-11-15T10:00:00Z');
const later = (ms: number) => new Date(T0.getTime() + ms);

async function setup() {
  const device = new DeviceStore(new MemoryKv());
  const p = await device.createProfile({ mode: 'phone', displayName: 'Sara' });
  return { device, id: p.id };
}

describe('App lock', () => {
  beforeEach(() => lockNow());

  it('is off until a password is set', async () => {
    const { device, id } = await setup();
    expect(needsUnlock((await device.getProfile(id))!)).toBe(false);
  });

  it('sets a password, returns a recovery code and keeps only hashes', async () => {
    const { device, id } = await setup();
    const code = await setPassword(device, id, 'sunrise7', T0);
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const p = (await device.getProfile(id))!;
    expect(JSON.stringify(p.lock)).not.toContain('sunrise7');
    expect(JSON.stringify(p.lock)).not.toContain(normalizeRecovery(code));
    // Setting it unlocks this tab; locking asks for it again.
    expect(needsUnlock(p)).toBe(false);
    lockNow();
    expect(needsUnlock(p)).toBe(true);
  });

  it('unlocks with the right password only', async () => {
    const { device, id } = await setup();
    await setPassword(device, id, 'sunrise7', T0);
    lockNow();
    expect(await unlock(device, id, 'sunrise8', T0)).toEqual({ ok: false, reason: 'wrong' });
    expect(needsUnlock((await device.getProfile(id))!)).toBe(true);
    expect(await unlock(device, id, ' sunrise7 ', T0)).toEqual({ ok: true });
    expect(needsUnlock((await device.getProfile(id))!)).toBe(false);
  });

  it('accepts Arabic digits for the same password', async () => {
    const { device, id } = await setup();
    await setPassword(device, id, 'kemet2026', T0);
    lockNow();
    expect((await unlock(device, id, 'kemet٢٠٢٦', T0)).ok).toBe(true);
    expect(normalizePassword('۱۲۳۴۵۶')).toBe('123456');
  });

  it('makes the user wait after too many wrong tries, then longer each time', async () => {
    const { device, id } = await setup();
    await setPassword(device, id, 'sunrise7', T0);
    lockNow();
    for (let i = 1; i < FREE_TRIES; i++) expect((await unlock(device, id, 'nope-nope', T0)).ok).toBe(false);
    const first = await unlock(device, id, 'nope-nope', T0);
    expect(first).toEqual({ ok: false, reason: 'wait', retryAt: later(30_000).toISOString() });
    // Even the right password waits.
    expect((await unlock(device, id, 'sunrise7', later(10_000))).ok).toBe(false);
    const second = await unlock(device, id, 'nope-nope', later(31_000));
    expect(second).toEqual({ ok: false, reason: 'wait', retryAt: later(31_000 + 60_000).toISOString() });
    expect(await unlock(device, id, 'sunrise7', later(100_000))).toEqual({ ok: true });
    expect((await device.getProfile(id))!.lock!.failed).toBe(0);
  });

  it('resets a forgotten password with the recovery code, which then stops working', async () => {
    const { device, id } = await setup();
    const code = await setPassword(device, id, 'sunrise7', T0);
    lockNow();
    expect((await resetWithRecovery(device, id, 'AAAA-BBBB-CCCC', 'newpass1', T0)).ok).toBe(false);
    const r = await resetWithRecovery(device, id, code.toLowerCase().replace(/-/g, ' '), 'newpass1', T0);
    expect(r.ok).toBe(true);
    expect(r.recovery).toBeDefined();
    expect(r.recovery).not.toBe(code);
    lockNow();
    expect((await unlock(device, id, 'sunrise7', T0)).ok).toBe(false);
    expect((await unlock(device, id, 'newpass1', T0)).ok).toBe(true);
    lockNow();
    expect((await resetWithRecovery(device, id, code, 'another1', T0)).ok).toBe(false);
  });

  it('can remove the password with the recovery code or from settings', async () => {
    const { device, id } = await setup();
    const code = await setPassword(device, id, 'sunrise7', T0);
    lockNow();
    expect((await resetWithRecovery(device, id, code, null, T0)).ok).toBe(true);
    expect((await device.getProfile(id))!.lock).toBeNull();

    await setPassword(device, id, 'sunrise7', T0);
    expect((await checkPassword(device, id, 'sunrise7', T0)).ok).toBe(true);
    await removePassword(device, id);
    lockNow();
    expect(needsUnlock((await device.getProfile(id))!)).toBe(false);
  });

  it('rejects short passwords', async () => {
    const { device, id } = await setup();
    expect(isValidPassword('12345')).toBe(false);
    expect(isValidPassword('123456')).toBe(true);
    await expect(setPassword(device, id, 'abc', T0)).rejects.toThrow('invalid_password');
  });

  it('makes recovery codes from the unambiguous alphabet', () => {
    const codes = new Set(Array.from({ length: 200 }, newRecoveryCode));
    expect(codes.size).toBe(200);
    for (const c of codes) expect(c).not.toMatch(/[01ILO]/);
  });
});

describe('lockedProfile', () => {
  it('is used by the loaders to show the unlock screen', async () => {
    // deviceKv() falls back to memory in tests, so this checks only the no-profile case.
    expect(await lockedProfile()).toBeNull();
  });
});
