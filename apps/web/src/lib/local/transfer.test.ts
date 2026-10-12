import { describe, expect, it } from 'vitest';

import { DeviceStore } from './device';
import { demoStations } from './demo-answers';
import { MemoryKv } from './kv';
import { localRuntimeFor } from './runtime';
import {
  BundleError,
  exportProfile,
  groupCode,
  importProfile,
  normalizeCode,
  openTransfer,
  openWithPassphrase,
  parseSealed,
  sealForTransfer,
  sealWithPassphrase,
} from './transfer';

async function deviceWithResult() {
  const kv = new MemoryKv();
  const device = new DeviceStore(kv);
  let profile = await device.createProfile({ mode: 'phone', ageBand: '21-25' });
  profile = await device.setConsent(profile.id, { basis: 'adult_self', textVersion: 't', policyVersion: 'p' });
  await device.setActiveId(profile.id);
  const rt = localRuntimeFor(kv, profile);
  const { session } = await rt.service.startSession(rt.userId, {});
  for (const [station, responses] of demoStations()) {
    await rt.service.saveResponses(rt.userId, { sessionId: session.id, station, responses });
    await rt.service.completeStation(rt.userId, { sessionId: session.id, station });
  }
  const result = await rt.service.finalize(rt.userId, { sessionId: session.id });
  return { kv, profile, result };
}

async function code(p: Promise<unknown>) {
  try {
    await p;
    return 'no_error';
  } catch (e) {
    if (e instanceof BundleError) return e.code;
    throw e;
  }
}

describe('moving data between phones', () => {
  it('restores the same result on another device from a passphrase backup', async () => {
    const { kv, profile, result } = await deviceWithResult();
    const sealed = await sealWithPassphrase(await exportProfile(kv, profile.id), 'نجمة صفرا 2026', 1000);
    const file = JSON.stringify(sealed);
    expect(file).not.toContain(result.sessionId);

    const otherKv = new MemoryKv();
    const restored = await importProfile(otherKv, await openWithPassphrase(parseSealed(file), 'نجمة صفرا 2026'));
    const latest = await localRuntimeFor(otherKv, restored).service.getLatestResult(restored.id);
    expect(latest?.sessionId).toBe(result.sessionId);
    expect(await new DeviceStore(otherKv).getActiveId()).toBe(profile.id);
  });

  it('refuses a wrong passphrase and a file that is not a backup', async () => {
    const { kv, profile } = await deviceWithResult();
    const sealed = await sealWithPassphrase(await exportProfile(kv, profile.id), 'right', 1000);
    expect(await code(openWithPassphrase(sealed, 'wrong'))).toBe('wrong_secret');
    expect(() => parseSealed('{"hello":1}')).toThrow(BundleError);
    expect(() => parseSealed('not json')).toThrow(BundleError);
  });

  it('opens a transfer with its key, typed loosely, and not with another key', async () => {
    const { kv, profile } = await deviceWithResult();
    const { sealed, key } = await sealForTransfer(await exportProfile(kv, profile.id));
    expect(key).toMatch(/^[0-9A-HJKMNP-TV-Z]{16}$/);
    const typed = groupCode(key).toLowerCase();
    expect((await openTransfer(sealed, typed)).profile.id).toBe(profile.id);
    const other = key.startsWith('0') ? `1${key.slice(1)}` : `0${key.slice(1)}`;
    expect(await code(openTransfer(sealed, other))).toBe('wrong_secret');
  });

  it('replaces the profile already on the receiving phone', async () => {
    const { kv, profile } = await deviceWithResult();
    const bundle = await exportProfile(kv, profile.id);
    const otherKv = new MemoryKv();
    const otherDevice = new DeviceStore(otherKv);
    const old = await otherDevice.createProfile({ mode: 'phone' });
    await otherDevice.setActiveId(old.id);
    await importProfile(otherKv, bundle);
    expect(await otherDevice.getProfile(old.id)).toBeNull();
    expect((await otherDevice.listProfiles()).map((p) => p.id)).toEqual([profile.id]);
  });

  it('moves path (Verify) answers and results, and deletes them with the profile', async () => {
    const { kv, profile } = await deviceWithResult();
    await kv.set(`journey:${profile.id}`, { v: 1, paths: { tech: { answers: { tech_day_1: 3 } } } });
    const other = new MemoryKv();
    await importProfile(other, await exportProfile(kv, profile.id));
    expect(await other.get(`journey:${profile.id}`)).toEqual({ v: 1, paths: { tech: { answers: { tech_day_1: 3 } } } });
    await new DeviceStore(other).deleteProfile(profile.id);
    expect(await other.get(`journey:${profile.id}`)).toBeUndefined();
  });

  it('normalizes look-alike characters in typed codes', () => {
    expect(normalizeCode('abcd-efgh ijkl-mnop')).toBe('ABCDEFGH1JK1MN0P');
  });
});
