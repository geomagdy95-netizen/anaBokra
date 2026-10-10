import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SaveFailure, SaveQueue, type StorageLike } from './save-queue';

interface Item {
  id: string;
  v: number;
}
const key = (i: Item) => i.id;

function memStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('SaveQueue', () => {
  it('debounces and batches, last write wins per item', async () => {
    const send = vi.fn<(items: Item[]) => Promise<void>>(async () => {});
    const q = new SaveQueue<Item>({ send, keyOf: key, debounceMs: 500 });
    q.add({ id: 'a', v: 1 });
    q.add({ id: 'b', v: 1 });
    await vi.advanceTimersByTimeAsync(300);
    q.add({ id: 'a', v: 2 });
    await vi.advanceTimersByTimeAsync(499);
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toEqual([{ id: 'a', v: 2 }, { id: 'b', v: 1 }]);
    expect(q.status).toBe('idle');
  });

  it('never holds a change longer than maxWait while the user keeps answering', async () => {
    const send = vi.fn<(items: Item[]) => Promise<void>>(async () => {});
    const q = new SaveQueue<Item>({ send, keyOf: key, debounceMs: 1000, maxWaitMs: 2500 });
    for (let i = 0; i < 6; i++) {
      q.add({ id: `i${i}`, v: i });
      await vi.advanceTimersByTimeAsync(600);
    }
    expect(send).toHaveBeenCalled();
  });

  it('retries retryable failures with backoff and keeps newer values', async () => {
    const calls: Item[][] = [];
    let fail = 2;
    const send = vi.fn(async (items: Item[]) => {
      calls.push(items);
      if (fail-- > 0) throw new SaveFailure('network', true);
    });
    const q = new SaveQueue<Item>({ send, keyOf: key, debounceMs: 10, retryDelaysMs: [100, 200] });
    q.add({ id: 'a', v: 1 });
    await vi.advanceTimersByTimeAsync(10);
    expect(q.status).toBe('retrying');
    q.add({ id: 'a', v: 2 }); // newer value while backing off
    await vi.advanceTimersByTimeAsync(100);
    expect(q.status).toBe('retrying');
    await vi.advanceTimersByTimeAsync(200);
    expect(send).toHaveBeenCalledTimes(3);
    expect(calls[2]).toEqual([{ id: 'a', v: 2 }]);
    expect(q.status).toBe('idle');
    expect(q.pendingItems()).toEqual([]);
  });

  it('waits while offline and sends as soon as it is back online', async () => {
    let online = false;
    const send = vi.fn<(items: Item[]) => Promise<void>>(async () => {});
    const q = new SaveQueue<Item>({ send, keyOf: key, debounceMs: 10, isOnline: () => online });
    q.add({ id: 'a', v: 1 });
    await vi.advanceTimersByTimeAsync(10);
    expect(send).not.toHaveBeenCalled();
    expect(q.status).toBe('offline');
    online = true;
    q.notifyOnline();
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(1);
    expect(q.status).toBe('idle');
  });

  it('drops a permanently rejected batch, reports it, and keeps going', async () => {
    const onFatal = vi.fn();
    const send = vi.fn(async (items: Item[]) => {
      if (items[0]!.id === 'bad') throw new SaveFailure('invalid_value', false, 'invalid_value');
    });
    const q = new SaveQueue<Item>({ send, keyOf: key, debounceMs: 10, onFatal });
    q.add({ id: 'bad', v: 1 });
    await vi.advanceTimersByTimeAsync(10);
    expect(onFatal).toHaveBeenCalledTimes(1);
    q.add({ id: 'ok', v: 1 });
    await vi.advanceTimersByTimeAsync(10);
    expect(send).toHaveBeenCalledTimes(2);
    expect(q.pendingItems()).toEqual([]);
  });

  it('flush() resolves after everything is saved', async () => {
    const send = vi.fn<(items: Item[]) => Promise<void>>(async () => {});
    const q = new SaveQueue<Item>({ send, keyOf: key, debounceMs: 5000 });
    q.add({ id: 'a', v: 1 });
    await q.flush();
    expect(send).toHaveBeenCalledTimes(1);
    await expect(q.flush()).resolves.toBeUndefined();
  });

  it('persists unsent changes and restores them in a new queue', async () => {
    const storage = memStorage();
    const down = vi.fn<(items: Item[]) => Promise<void>>(async () => {
      throw new SaveFailure('network', true);
    });
    const q1 = new SaveQueue<Item>({ send: down, keyOf: key, debounceMs: 10, storage, storageKey: 'k' });
    q1.add({ id: 'a', v: 7 });
    await vi.advanceTimersByTimeAsync(10);
    q1.dispose();
    expect(storage.data.get('k')).toContain('"v":7');

    const send = vi.fn<(items: Item[]) => Promise<void>>(async () => {});
    const q2 = new SaveQueue<Item>({ send, keyOf: key, debounceMs: 10, storage, storageKey: 'k' });
    expect(q2.pendingItems()).toEqual([{ id: 'a', v: 7 }]);
    await vi.advanceTimersByTimeAsync(10);
    expect(send).toHaveBeenCalledWith([{ id: 'a', v: 7 }]);
    expect(storage.data.has('k')).toBe(false);
  });
});
