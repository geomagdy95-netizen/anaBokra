import { describe, expect, it } from 'vitest';

import { FavoritesError, mapFavoritesError, memoryFavoritesStore } from './favorites';

describe('memory favorites store', () => {
  it('adds idempotently, keeps order, removes, and isolates users', async () => {
    const backing = new Map<string, string[]>();
    const a = memoryFavoritesStore('a', backing);
    await a.add('nurse');
    await a.add('pilot');
    await a.add('nurse');
    expect(await a.list()).toEqual(['nurse', 'pilot']);
    await a.remove('nurse');
    expect(await a.list()).toEqual(['pilot']);
    expect(await memoryFavoritesStore('b', backing).list()).toEqual([]);
  });
});

describe('mapFavoritesError', () => {
  it('maps the engagement consent gate (42501) to consent_required', () => {
    expect(mapFavoritesError({ code: '42501', message: 'consent_required: guardian consent is needed' })).toEqual(new FavoritesError('consent_required'));
    expect(mapFavoritesError({ message: 'consent_required: x' }).code).toBe('consent_required');
  });
  it('maps an unknown career (FK) to not_found and anything else to unavailable', () => {
    expect(mapFavoritesError({ code: '23503' }).code).toBe('not_found');
    expect(mapFavoritesError({ code: '08006', message: 'boom' }).code).toBe('unavailable');
  });
});
