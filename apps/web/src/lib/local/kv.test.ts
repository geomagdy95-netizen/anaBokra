import { describe, expect, it } from 'vitest';

import { EncryptedKv, MemoryKv, newDeviceKey } from './kv';

describe('EncryptedKv', () => {
  it('round-trips values and stores only ciphertext underneath', async () => {
    const inner = new MemoryKv();
    const kv = new EncryptedKv(inner, await newDeviceKey());
    const value = { name: 'سارة', answers: { ip_R01: 4 }, list: [1, 2, 3] };
    await kv.set('profile:1', value);
    expect(await kv.get('profile:1')).toEqual(value);

    const raw = await inner.get<{ iv: Uint8Array; data: ArrayBuffer }>('profile:1');
    expect(raw?.iv).toHaveLength(12);
    expect(new TextDecoder().decode(raw!.data)).not.toContain('ip_R01');
  });

  it('uses a fresh IV for every write', async () => {
    const inner = new MemoryKv();
    const kv = new EncryptedKv(inner, await newDeviceKey());
    await kv.set('a', 1);
    const first = (await inner.get<{ iv: Uint8Array }>('a'))!.iv;
    await kv.set('a', 1);
    const second = (await inner.get<{ iv: Uint8Array }>('a'))!.iv;
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(false);
  });

  it("can't be read with another device's key", async () => {
    const inner = new MemoryKv();
    await new EncryptedKv(inner, await newDeviceKey()).set('a', { secret: true });
    await expect(new EncryptedKv(inner, await newDeviceKey()).get('a')).rejects.toThrow();
  });

  it('passes key listing and deletion through', async () => {
    const kv = new EncryptedKv(new MemoryKv(), await newDeviceKey());
    await kv.set('profile:1', 1);
    await kv.set('assessment:1', 2);
    expect((await kv.keys('profile:')).sort()).toEqual(['profile:1']);
    await kv.delete('profile:1');
    expect(await kv.get('profile:1')).toBeUndefined();
  });
});
