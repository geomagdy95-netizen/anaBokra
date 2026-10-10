import { describe, expect, it } from 'vitest';

import { parseRole, safeNextPath } from './roles';

describe('safeNextPath', () => {
  it('keeps same-site relative paths', () => {
    expect(safeNextPath('/account')).toBe('/account');
    expect(safeNextPath('/careers?x=1')).toBe('/careers?x=1');
  });
  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', '/api/auth/signout', 'account', undefined, 42])(
    'rejects %j',
    (v) => expect(safeNextPath(v)).toBe('/account'),
  );
});

describe('parseRole', () => {
  it('only ever yields student or parent', () => {
    expect(parseRole('parent')).toBe('parent');
    expect(parseRole('admin')).toBe('student');
    expect(parseRole(undefined)).toBe('student');
  });
});
