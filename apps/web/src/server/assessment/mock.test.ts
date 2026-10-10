import { describe, expect, it } from 'vitest';

import { isMockMode } from './mock';

describe('dev mock mode', () => {
  it('is on only for ASSESSMENT_REPO=memory outside production', () => {
    expect(isMockMode({ ASSESSMENT_REPO: 'memory', NODE_ENV: 'development' })).toBe(true);
    expect(isMockMode({ ASSESSMENT_REPO: 'memory', NODE_ENV: 'test' })).toBe(true);
  });
  it('is never on in production', () => {
    expect(isMockMode({ ASSESSMENT_REPO: 'memory', NODE_ENV: 'production' })).toBe(false);
  });
  it('is off by default', () => {
    expect(isMockMode({ NODE_ENV: 'development' })).toBe(false);
    expect(isMockMode({ ASSESSMENT_REPO: 'supabase', NODE_ENV: 'development' })).toBe(false);
  });
});
