import { describe, expect, it } from 'vitest';

import { MemoryKv } from '@/lib/local/kv';

import { affecting, saveSituation } from './situation';
import { readJourney } from './verify';

describe('situation', () => {
  it('marks the hurdles that weigh more for this user', () => {
    const hurdles = [
      { kind: 'cost', level: 3 },
      { kind: 'location', level: 2 },
      { kind: 'time', level: 2 },
      { kind: 'interview', level: 3 },
    ];
    expect([...affecting(undefined, hurdles)]).toEqual([]);
    expect([...affecting({ budget: 'public', region: 'upper', work: true, at: '' }, hurdles)].sort()).toEqual(['cost', 'location', 'time']);
    expect([...affecting({ budget: 'some', region: 'cairo', at: '' }, [{ kind: 'cost', level: 2 }])]).toEqual([]);
    expect([...affecting({ budget: 'some', at: '' }, [{ kind: 'cost', level: 3 }])]).toEqual(['cost']);
    expect([...affecting({ budget: 'private', at: '' }, hurdles)]).toEqual([]);
  });

  it('is saved on the device and can be forgotten', async () => {
    const kv = new MemoryKv();
    await saveSituation(kv, 'p1', { budget: 'public', region: 'delta' }, new Date('2026-10-15T10:00:00Z'));
    expect((await readJourney(kv, 'p1')).situation).toEqual({ budget: 'public', region: 'delta', at: '2026-10-15T10:00:00.000Z' });
    await saveSituation(kv, 'p1', null);
    expect((await readJourney(kv, 'p1')).situation).toBeUndefined();
  });
});
