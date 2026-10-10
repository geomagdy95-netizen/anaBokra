import { INVITE_TTL_DAYS, MAX_RESENDS_PER_DAY } from './constants';

/**
 * Invite state machine (derived from timestamps, so it cannot drift):
 *
 *   pending --open--> opened --confirm--> granted
 *      |                 |---decline---> declined
 *      |                 '--(7 days)---> expired
 *      '--(7 days)-------------------->  expired
 *   any live state --teen changes number / cancels--> revoked
 *
 * granted / declined / expired / revoked are final: a new invite is a new row.
 */
export type InviteStatus = 'pending' | 'opened' | 'granted' | 'declined' | 'expired' | 'revoked';

export interface InviteTimes {
  expiresAt: string;
  openedAt: string | null;
  usedAt: string | null;
  declinedAt: string | null;
  revokedAt: string | null;
}

export function inviteStatus(i: InviteTimes, now: Date): InviteStatus {
  if (i.usedAt) return 'granted';
  if (i.declinedAt) return 'declined';
  if (i.revokedAt) return 'revoked';
  if (new Date(i.expiresAt).getTime() <= now.getTime()) return 'expired';
  return i.openedAt ? 'opened' : 'pending';
}

export const isLive = (s: InviteStatus): boolean => s === 'pending' || s === 'opened';
export const isFinal = (s: InviteStatus): boolean => !isLive(s);

const TRANSITIONS: Record<InviteStatus, InviteStatus[]> = {
  pending: ['opened', 'granted', 'declined', 'expired', 'revoked'],
  opened: ['granted', 'declined', 'expired', 'revoked'],
  granted: [],
  declined: [],
  expired: [],
  revoked: [],
};
export const canTransition = (from: InviteStatus, to: InviteStatus): boolean => TRANSITIONS[from].includes(to);

export const expiryFrom = (now: Date, days = INVITE_TTL_DAYS): Date => new Date(now.getTime() + days * 86_400_000);

const DAY_MS = 86_400_000;

/** Send budget in the rolling last 24h: the first send plus `maxResends` resends. */
export function sendBudget(sends: readonly string[], now: Date, maxResends = MAX_RESENDS_PER_DAY) {
  const recent = sends.filter((s) => now.getTime() - new Date(s).getTime() < DAY_MS).map((s) => new Date(s).getTime());
  const allowed = 1 + maxResends;
  const remaining = Math.max(0, allowed - recent.length);
  // When blocked, the next slot opens when the oldest recent send leaves the 24h window.
  const retryAt = remaining > 0 ? null : new Date(Math.min(...recent) + DAY_MS);
  return { remaining, canSend: remaining > 0, retryAt };
}
