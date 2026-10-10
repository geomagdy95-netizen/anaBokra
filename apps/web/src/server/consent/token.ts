import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 32 random bytes, base64url (43 chars). Shown once: only its hash is stored. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Hex of SHA-256(utf8 token): same scheme as the DB (sha256(convert_to(token, 'UTF8'))). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;
/** Tokens from the older DB function are 64 hex chars; accept both shapes, nothing else reaches the DB. */
export const isTokenShape = (t: unknown): t is string => typeof t === 'string' && (TOKEN_SHAPE.test(t) || /^[0-9a-f]{64}$/.test(t));

export function hashesEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}
