import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { generateToken, hashesEqual, hashToken, isTokenShape } from './token';

describe('consent tokens', () => {
  it('are 32 random bytes (43 base64url chars) and never repeat', () => {
    const tokens = new Set(Array.from({ length: 500 }, generateToken));
    expect(tokens.size).toBe(500);
    for (const t of tokens) {
      expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(t, 'base64url')).toHaveLength(32);
    }
  });

  it('are stored as the hex SHA-256 of the utf8 token (same scheme as sha256(convert_to(token, UTF8)) in SQL)', () => {
    expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const t = generateToken();
    expect(hashToken(t)).toBe(createHash('sha256').update(t).digest('hex'));
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).not.toContain(t);
  });

  it('compare hashes in constant time and reject malformed input', () => {
    const h = hashToken('x');
    expect(hashesEqual(h, hashToken('x'))).toBe(true);
    expect(hashesEqual(h, hashToken('y'))).toBe(false);
    expect(hashesEqual(h, 'abcd')).toBe(false);
  });

  it('are shape-checked before they reach the database', () => {
    expect(isTokenShape(generateToken())).toBe(true);
    expect(isTokenShape('a'.repeat(64))).toBe(true);
    for (const bad of ['', 'short', 'x'.repeat(44), `${'a'.repeat(42)}!`, 'a'.repeat(43) + '\n', null, undefined, 42, "' or 1=1 --"]) {
      expect(isTokenShape(bad)).toBe(false);
    }
  });
});
