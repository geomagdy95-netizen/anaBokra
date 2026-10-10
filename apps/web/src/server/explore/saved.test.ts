import { describe, expect, it } from 'vitest';

import { makeRef, parseRef, refExists } from '@/features/explore/saved-ref';

import { mapSavedError, memorySavedStore, SavedError } from './saved';

describe('memory saved store', () => {
  it('adds idempotently, keeps order, removes, and isolates users', async () => {
    const backing = new Map<string, string[]>();
    const a = memorySavedStore('a', backing);
    await a.add('program:x');
    await a.add('university:y');
    await a.add('program:x');
    expect(await a.list()).toEqual(['program:x', 'university:y']);
    await a.remove('program:x');
    expect(await a.list()).toEqual(['university:y']);
    expect(await memorySavedStore('b', backing).list()).toEqual([]);
  });
});

describe('refs', () => {
  it('round-trips and validates against content', () => {
    expect(parseRef(makeRef('program', 'cairo-university-medicine'))).toEqual({ kind: 'program', id: 'cairo-university-medicine' });
    expect(parseRef('bogus:1')).toBeNull();
    expect(parseRef('program')).toBeNull();
    expect(refExists('program:cairo-university-medicine')).toBe(true);
    expect(refExists('university:cairo-university')).toBe(true);
    expect(refExists('program:nope')).toBe(false);
  });
});

describe('mapSavedError', () => {
  it('maps the consent gate, FK misses and others', () => {
    expect(mapSavedError({ code: '42501', message: 'consent_required: x' })).toEqual(new SavedError('consent_required'));
    expect(mapSavedError({ message: 'consent_required' }).code).toBe('consent_required');
    expect(mapSavedError({ code: '23503' }).code).toBe('not_found');
    expect(mapSavedError({ code: '08006' }).code).toBe('unavailable');
  });
});
