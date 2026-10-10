/**
 * Tiny key-value store for data that lives on the device (phase 1: nothing personal goes to a server).
 * IndexedDB in the browser; an in-memory store for tests and as a fallback when IndexedDB is blocked
 * (private windows on some browsers), in which case data lasts only for the page's lifetime.
 */
export interface KvStore {
  /** False when data will not survive a reload (in-memory fallback). */
  readonly persistent: boolean;
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
  clear(): Promise<void>;
}

export class MemoryKv implements KvStore {
  readonly persistent = false;
  private map = new Map<string, unknown>();

  async get<T>(key: string) {
    const v = this.map.get(key);
    return v === undefined ? undefined : (structuredClone(v) as T);
  }
  async set<T>(key: string, value: T) {
    this.map.set(key, structuredClone(value));
  }
  async delete(key: string) {
    this.map.delete(key);
  }
  async keys(prefix = '') {
    return [...this.map.keys()].filter((k) => k.startsWith(prefix));
  }
  async clear() {
    this.map.clear();
  }
}

const DB_NAME = 'anabokra';
const STORE = 'kv';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class IndexedDbKv implements KvStore {
  readonly persistent = true;
  private db: Promise<IDBDatabase> | null = null;

  constructor(private readonly name = DB_NAME) {}

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(this.name, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('indexeddb_blocked'));
    });
    return this.db;
  }

  private async store(mode: IDBTransactionMode) {
    return (await this.open()).transaction(STORE, mode).objectStore(STORE);
  }

  async get<T>(key: string) {
    return (await request((await this.store('readonly')).get(key))) as T | undefined;
  }
  async set<T>(key: string, value: T) {
    await request((await this.store('readwrite')).put(value, key));
  }
  async delete(key: string) {
    await request((await this.store('readwrite')).delete(key));
  }
  async keys(prefix = '') {
    const all = (await request((await this.store('readonly')).getAllKeys())) as IDBValidKey[];
    return all.map(String).filter((k) => k.startsWith(prefix));
  }
  async clear() {
    await request((await this.store('readwrite')).clear());
  }
}

let shared: Promise<KvStore> | null = null;

/** The device's store: IndexedDB when it works, otherwise memory (data then lasts until the page closes). */
export function deviceKv(): Promise<KvStore> {
  shared ??= (async () => {
    if (typeof indexedDB === 'undefined') return new MemoryKv();
    const kv = new IndexedDbKv();
    try {
      await kv.keys('__probe__');
      return kv;
    } catch {
      return new MemoryKv();
    }
  })();
  return shared;
}
