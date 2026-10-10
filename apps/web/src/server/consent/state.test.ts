import { describe, expect, it } from 'vitest';

import { canTransition, expiryFrom, inviteStatus, isFinal, isLive, sendBudget, type InviteTimes } from './state';

const t0 = new Date('2026-10-09T10:00:00Z');
const at = (days: number, hours = 0) => new Date(t0.getTime() + days * 86_400_000 + hours * 3_600_000);
const base: InviteTimes = { expiresAt: at(7).toISOString(), openedAt: null, usedAt: null, declinedAt: null, revokedAt: null };

describe('invite state machine', () => {
  it('pending -> opened -> granted / declined', () => {
    expect(inviteStatus(base, t0)).toBe('pending');
    expect(inviteStatus({ ...base, openedAt: t0.toISOString() }, at(1))).toBe('opened');
    expect(inviteStatus({ ...base, openedAt: t0.toISOString(), usedAt: at(1).toISOString() }, at(2))).toBe('granted');
    expect(inviteStatus({ ...base, openedAt: t0.toISOString(), declinedAt: at(1).toISOString() }, at(2))).toBe('declined');
  });

  it('expires exactly at the 7-day mark, from any live state', () => {
    expect(expiryFrom(t0).toISOString()).toBe(at(7).toISOString());
    expect(inviteStatus(base, at(7, -1))).toBe('pending');
    expect(inviteStatus(base, at(7))).toBe('expired');
    expect(inviteStatus({ ...base, openedAt: t0.toISOString() }, at(8))).toBe('expired');
  });

  it('final states win over expiry; revoked is its own state', () => {
    expect(inviteStatus({ ...base, usedAt: at(1).toISOString() }, at(30))).toBe('granted');
    expect(inviteStatus({ ...base, declinedAt: at(1).toISOString() }, at(30))).toBe('declined');
    expect(inviteStatus({ ...base, revokedAt: at(1).toISOString() }, at(2))).toBe('revoked');
  });

  it('only pending/opened are live; final states have no way out', () => {
    expect(isLive('pending') && isLive('opened')).toBe(true);
    for (const s of ['granted', 'declined', 'expired', 'revoked'] as const) {
      expect(isFinal(s)).toBe(true);
      for (const to of ['pending', 'opened', 'granted', 'declined', 'expired', 'revoked'] as const) expect(canTransition(s, to)).toBe(false);
    }
    expect(canTransition('pending', 'opened')).toBe(true);
    expect(canTransition('opened', 'granted')).toBe(true);
    expect(canTransition('opened', 'pending')).toBe(false);
  });
});

describe('send budget (first send + 3 resends per rolling day)', () => {
  it('allows 4 sends, then blocks until the oldest leaves the 24h window', () => {
    const sends = [0, 1, 2, 3].map((h) => at(0, h).toISOString());
    expect(sendBudget([], t0).remaining).toBe(4);
    expect(sendBudget(sends.slice(0, 3), at(0, 4)).remaining).toBe(1);
    const blocked = sendBudget(sends, at(0, 5));
    expect(blocked.canSend).toBe(false);
    expect(blocked.retryAt?.toISOString()).toBe(at(1).toISOString());
    expect(sendBudget(sends, at(1, 0.5)).remaining).toBe(1); // the first send aged out
  });
});
