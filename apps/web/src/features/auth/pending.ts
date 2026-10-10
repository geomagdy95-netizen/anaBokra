/** The in-progress OTP login, kept in sessionStorage between /login and /verify (keeps phone numbers out of URLs). */
export interface PendingOtp {
  channel: 'phone' | 'email';
  /** E.164 phone or lower-cased email, as returned by the server. */
  target: string;
  masked: string;
  role: 'student' | 'parent';
  next?: string;
  /** epoch ms of the last send, drives the resend timer */
  sentAt: number;
}

const KEY = 'mx.pendingOtp';

export function savePending(p: PendingOtp): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode: the verify page will send the user back to login */
  }
}

export function readPendingRaw(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function parsePending(raw: string | null): PendingOtp | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingOtp;
  } catch {
    return null;
  }
}

export function clearPending(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export type OtpRequestResult =
  | { ok: true; channel: 'phone' | 'email'; target: string; masked: string }
  | { ok: false; error: string; retryAfterSec?: number };

/** POST /api/auth/otp/request. Never throws; network failures become { error: 'network' }. */
export async function requestOtp(input: {
  channel: 'phone' | 'email';
  phone?: string;
  email?: string;
  role: 'student' | 'parent';
  locale: string;
}): Promise<OtpRequestResult> {
  try {
    const res = await fetch('/api/auth/otp/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    return (await res.json()) as OtpRequestResult;
  } catch {
    return { ok: false, error: 'network' };
  }
}
