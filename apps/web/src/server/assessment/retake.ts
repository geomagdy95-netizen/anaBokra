/** A student may retake the full assessment this many days after their latest result (about 6 months). */
export const RETAKE_AFTER_DAYS = 182;

const DAY_MS = 24 * 60 * 60 * 1000;

export type RetakeStatus = { allowed: true } | { allowed: false; unlocksAt: string };

/** `completedAt` = when the latest result was stored (ISO). */
export function retakeStatus(completedAt: string, now: Date = new Date()): RetakeStatus {
  const unlocks = new Date(new Date(completedAt).getTime() + RETAKE_AFTER_DAYS * DAY_MS);
  return now.getTime() >= unlocks.getTime() ? { allowed: true } : { allowed: false, unlocksAt: unlocks.toISOString() };
}
