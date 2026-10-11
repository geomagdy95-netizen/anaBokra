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

interface Sealed {
  iv: Uint8Array<ArrayBuffer>;
  data: ArrayBuffer;
}

/**
 * Encrypts every value (AES-256-GCM, fresh IV per write) before it reaches the inner store. Keys
 * (record names) are not secret and stay readable. This keeps data unreadable outside the app (e.g.
 * the browser's storage files); it does not stop someone using the app on an unlocked device.
 */
export class EncryptedKv implements KvStore {
  constructor(
    private readonly inner: KvStore,
    private readonly key: CryptoKey,
  ) {}

  get persistent() {
    return this.inner.persistent;
  }

  async get<T>(key: string) {
    const sealed = await this.inner.get<Sealed>(key);
    // Records written before encryption existed (development only) read as missing.
    if (!sealed || !(sealed.iv instanceof Uint8Array)) return undefined;
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv }, this.key, sealed.data);
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  }
  async set<T>(key: string, value: T) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, new TextEncoder().encode(JSON.stringify(value)));
    await this.inner.set<Sealed>(key, { iv, data });
  }
  delete(key: string) {
    return this.inner.delete(key);
  }
  keys(prefix = '') {
    return this.inner.keys(prefix);
  }
  clear() {
    return this.inner.clear();
  }
}

/** A new random device key. Non-extractable: page scripts can use it but never read its bytes. */
export function newDeviceKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

const KEY_DB = 'anabokra-key';

/** The device key lives in its own IndexedDB database, so wiping the data store can't strand it. */
async function deviceKey(): Promise<CryptoKey> {
  const store = new IndexedDbKv(KEY_DB);
  const existing = await store.get<CryptoKey>('device');
  if (existing) return existing;
  const key = await newDeviceKey();
  await store.set('device', key);
  return key;
}

/** Forgets the device key: anything still encrypted with it can no longer be read. */
export async function forgetDeviceKey(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await new IndexedDbKv(KEY_DB).delete('device');
  shared = null;
}

let shared: Promise<KvStore> | null = null;

/**
 * The device's store: encrypted IndexedDB when it works, otherwise memory (data then lasts until the
 * page closes, and never touches disk).
 */
export function deviceKv(): Promise<KvStore> {
  shared ??= (async () => {
    if (typeof indexedDB === 'undefined' || typeof crypto?.subtle === 'undefined') return new MemoryKv();
    const kv = new IndexedDbKv();
    try {
      await kv.keys('__probe__');
      return new EncryptedKv(kv, await deviceKey());
    } catch {
      return new MemoryKv();
    }
  })();
  return shared;
}
