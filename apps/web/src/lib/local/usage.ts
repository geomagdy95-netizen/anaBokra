import type { UsageAction } from '@/lib/stats-summary';

/**
 * Counts of map and page actions and the career pages opened, kept in this browser until the next
 * statistics sync (lib/local/stats.ts) sends them, only if the user opted in, or drops them if not.
 * Counts and career ids only: nothing about who, and no times beyond the day the counts belong to.
 */

const USAGE_KEY = 'ab.usage';
const VIEWS_KEY = 'ab.views';

interface UsageBucket {
  day: string;
  counts: Partial<Record<UsageAction, number>>;
}

/** Today's counts, and earlier days' counts waiting to be sent (merged). */
interface UsageStore {
  cur: UsageBucket;
  done?: UsageBucket;
}

const today = (now = new Date()) => now.toISOString().slice(0, 10);

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked (private mode): nothing is counted */
  }
}

const merge = (a: UsageBucket['counts'], b: UsageBucket['counts']) => {
  const out = { ...a };
  for (const [k, n] of Object.entries(b) as [UsageAction, number][]) out[k] = Math.min(1000, (out[k] ?? 0) + n);
  return out;
};

/** Moves a finished day into the waiting bucket. */
function rolled(now: Date): UsageStore {
  const day = today(now);
  const s = read<UsageStore>(USAGE_KEY);
  if (!s) return { cur: { day, counts: {} } };
  if (s.cur.day >= day) return s;
  const done = s.done ? { day: s.done.day, counts: merge(s.done.counts, s.cur.counts) } : s.cur;
  return { cur: { day, counts: {} }, done: Object.keys(done.counts).length ? done : undefined };
}

/** Counts one action (no-op on the server or with storage blocked). */
export function track(action: UsageAction, now = new Date()): void {
  if (typeof window === 'undefined') return;
  const s = rolled(now);
  s.cur.counts[action] = Math.min(1000, (s.cur.counts[action] ?? 0) + 1);
  write(USAGE_KEY, s);
}

/** Notes that a career page was opened (once per career). */
export function trackView(careerId: string): void {
  if (typeof window === 'undefined') return;
  const views = read<string[]>(VIEWS_KEY) ?? [];
  if (!views.includes(careerId)) write(VIEWS_KEY, [...views, careerId].slice(-300));
}

/** Earlier days' counts, ready to send (null when there are none). */
export function finishedUsage(now = new Date()): UsageBucket | null {
  const s = rolled(now);
  write(USAGE_KEY, s);
  return s.done ?? null;
}

/** Forgets the counts that were just sent; today's keep counting. */
export function clearFinishedUsage(now = new Date()): void {
  const s = rolled(now);
  write(USAGE_KEY, { cur: s.cur });
}

export const viewedCareers = (): string[] => read<string[]>(VIEWS_KEY) ?? [];

/** Drops everything counted (statistics are off). */
export function dropUsage(): void {
  write(USAGE_KEY, null);
  write(VIEWS_KEY, null);
}
