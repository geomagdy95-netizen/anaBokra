export type SaveStatus = 'idle' | 'pending' | 'saving' | 'retrying' | 'offline' | 'error';

/** Thrown by `send`. `retryable` = network trouble / server hiccup (keep the data and try again). */
export class SaveFailure extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'SaveFailure';
  }
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveQueueOptions<T> {
  /** Deliver one batch. Throw `SaveFailure` (retryable or not); any other error counts as retryable. */
  send: (items: T[]) => Promise<void>;
  keyOf: (item: T) => string;
  /** Wait this long after the last change before sending (default 600 ms). */
  debounceMs?: number;
  /** ...but never hold a change longer than this, however fast the user keeps answering (default 3000 ms). */
  maxWaitMs?: number;
  maxBatch?: number;
  /** Backoff between retries; the last value repeats. */
  retryDelaysMs?: readonly number[];
  /** Unsent changes survive a reload here (localStorage). */
  storage?: StorageLike | null;
  storageKey?: string;
  isOnline?: () => boolean;
  onStatus?: (status: SaveStatus) => void;
  /** A batch was rejected for good (validation, session closed...). It is dropped so later answers still flow. */
  onFatal?: (error: SaveFailure, dropped: T[]) => void;
}

/**
 * Debounced, batched, last-write-wins save buffer with offline-tolerant retry.
 *
 * - `add()` coalesces by key, so answering the same item twice sends the latest value once.
 * - One request in flight at a time; changes made meanwhile ride in the next batch.
 * - Retryable failures keep the batch, back off (1s, 2s, 5s, 10s, 30s...), and retry at once on `notifyOnline()`.
 * - While the browser reports offline nothing is sent and attempts are not burnt.
 * - `flush()` resolves when everything is saved (rejects on a fatal rejection), so "next" / "pause"
 *   can wait for the data without blocking the UI while the user keeps answering.
 */
export class SaveQueue<T> {
  private pending = new Map<string, T>();
  private inflight: T[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private firstAddAt = 0;
  private attempt = 0;
  private running = false;
  private disposed = false;
  private waiters: { resolve: () => void; reject: (e: Error) => void }[] = [];
  private lastStatus: SaveStatus = 'idle';

  private readonly debounceMs: number;
  private readonly maxWaitMs: number;
  private readonly maxBatch: number;
  private readonly delays: readonly number[];

  constructor(private readonly o: SaveQueueOptions<T>) {
    this.debounceMs = o.debounceMs ?? 600;
    this.maxWaitMs = o.maxWaitMs ?? 3000;
    this.maxBatch = o.maxBatch ?? 50;
    this.delays = o.retryDelaysMs?.length ? o.retryDelaysMs : [1000, 2000, 5000, 10_000, 30_000];
    for (const item of this.restore()) this.pending.set(o.keyOf(item), item);
    if (this.pending.size) {
      this.setStatus('pending');
      this.schedule(this.debounceMs);
    }
  }

  /** Changes not yet confirmed by the server (includes restored ones). */
  pendingItems(): T[] {
    return [...this.inflight, ...this.pending.values()];
  }

  get status(): SaveStatus {
    return this.lastStatus;
  }

  add(item: T) {
    if (this.disposed) return;
    this.pending.set(this.o.keyOf(item), item);
    this.persist();
    if (this.retryTimer) {
      // Already backing off after a failure: the retry will carry this too.
      this.setStatus(this.online() ? 'retrying' : 'offline');
      return;
    }
    if (!this.running) {
      this.setStatus('pending');
      const now = Date.now();
      if (!this.debounceTimer) this.firstAddAt = now;
      this.schedule(Math.max(0, Math.min(this.debounceMs, this.firstAddAt + this.maxWaitMs - now)));
    }
  }

  /** Send everything now. Resolves once nothing is pending or in flight. */
  flush(): Promise<void> {
    if (this.pending.size === 0 && !this.running) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      this.waiters.push({ resolve, reject });
      this.clearTimers();
      void this.run();
    });
  }

  /** The browser came back online: retry immediately instead of waiting out the backoff. */
  notifyOnline() {
    if (this.disposed || !(this.retryTimer || this.pending.size)) return;
    this.attempt = 0;
    this.clearTimers();
    void this.run();
  }

  dispose() {
    this.disposed = true;
    this.clearTimers();
    for (const w of this.waiters.splice(0)) w.reject(new Error('disposed'));
  }

  // -------------------------------------------------------------------------

  private online() {
    return this.o.isOnline ? this.o.isOnline() : true;
  }

  private schedule(ms: number) {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.run();
    }, ms);
  }

  private clearTimers() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.debounceTimer = this.retryTimer = null;
  }

  private setStatus(s: SaveStatus) {
    if (s === this.lastStatus) return;
    this.lastStatus = s;
    this.o.onStatus?.(s);
  }

  private async run(): Promise<void> {
    if (this.running || this.disposed) return;
    this.running = true;
    try {
      while (this.pending.size > 0 && !this.disposed) {
        if (!this.online()) {
          this.waitToRetry();
          return;
        }
        const batch = [...this.pending.entries()].slice(0, this.maxBatch);
        for (const [k] of batch) this.pending.delete(k);
        this.inflight = batch.map(([, v]) => v);
        this.setStatus('saving');
        try {
          await this.o.send(this.inflight);
          this.attempt = 0;
          this.inflight = [];
          this.persist();
        } catch (e) {
          const failure = e instanceof SaveFailure ? e : new SaveFailure(e instanceof Error ? e.message : 'send failed', true);
          const items = this.inflight;
          this.inflight = [];
          if (failure.retryable) {
            // Put the batch back, but never over a newer value for the same item.
            for (const item of items) if (!this.pending.has(this.o.keyOf(item))) this.pending.set(this.o.keyOf(item), item);
            this.persist();
            this.attempt++;
            this.waitToRetry();
            return;
          }
          this.persist();
          this.setStatus('error');
          this.o.onFatal?.(failure, items);
          for (const w of this.waiters.splice(0)) w.reject(failure);
        }
      }
      if (!this.disposed && this.pending.size === 0) {
        if (this.lastStatus !== 'error') this.setStatus('idle');
        for (const w of this.waiters.splice(0)) w.resolve();
      }
    } finally {
      this.running = false;
    }
  }

  private waitToRetry() {
    const online = this.online();
    this.setStatus(online ? 'retrying' : 'offline');
    // Offline: poll cheaply (the `online` event retries sooner). Online: exponential backoff.
    const delay = online ? this.delays[Math.min(Math.max(this.attempt - 1, 0), this.delays.length - 1)]! : 5000;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.run();
    }, delay);
  }

  // Persistence: best effort, never throws.
  private persist() {
    const { storage, storageKey } = this.o;
    if (!storage || !storageKey) return;
    try {
      const items = this.pendingItems();
      if (items.length) storage.setItem(storageKey, JSON.stringify(items));
      else storage.removeItem(storageKey);
    } catch {
      /* storage full or blocked: in-memory retry still works */
    }
  }

  private restore(): T[] {
    const { storage, storageKey } = this.o;
    if (!storage || !storageKey) return [];
    try {
      const raw = storage.getItem(storageKey);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
}
