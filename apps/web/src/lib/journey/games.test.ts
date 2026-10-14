import { describe, expect, it } from 'vitest';

import { sampleNorms } from '@/features/games/score';
import { MemoryKv } from '@/lib/local/kv';

import { abilityStandings, cachedNorms, comparisonBand, playedGameSteps, refreshNorms, saveGame } from './games';
import { readJourney } from './verify';

const rec = (points: number) => ({ at: '2026-10-15T10:00:00Z', points, shown: 5, of: 8 });

describe('Discover games on the phone', () => {
  it('keeps only the first full play of each game', async () => {
    const kv = new MemoryKv();
    expect(await saveGame(kv, 'p1', 'pattern', rec(12))).toBe(true);
    expect(await saveGame(kv, 'p1', 'pattern', rec(20))).toBe(false);
    const j = await readJourney(kv, 'p1');
    expect(j.games?.pattern?.points).toBe(12);
    expect(playedGameSteps(j)).toEqual(['game_pattern']);
  });

  it('caches the comparison table for a day and falls back to it offline', async () => {
    const kv = new MemoryKv();
    const norms = sampleNorms();
    expect(await refreshNorms(kv, 1000, async () => norms)).toEqual(norms);
    // Within a day: no fetch at all.
    expect(await refreshNorms(kv, 2000, async () => { throw new Error('should not fetch'); })).toEqual(norms);
    // A day later and offline: the old copy.
    expect(await refreshNorms(kv, 1000 + 25 * 3600 * 1000, async () => { throw new Error('offline'); })).toEqual(norms);
    expect(await cachedNorms(kv)).toEqual(norms);
  });

  it('turns first plays into ability standings only where enough players compare', async () => {
    const kv = new MemoryKv();
    await saveGame(kv, 'p1', 'pattern', rec(18));
    await saveGame(kv, 'p1', 'memory', rec(7));
    await saveGame(kv, 'p1', 'patience', { ...rec(0), shown: 3, of: 6 });
    const j = await readJourney(kv, 'p1');
    const s = abilityStandings(j, sampleNorms(), comparisonBand('18-20'));
    expect(Object.keys(s)).toEqual(['logical']);
    expect(s.logical).toBeGreaterThan(0.8);
    expect(abilityStandings(j, null, null)).toEqual({});
    expect(comparisonBand('under15')).toBeNull();
  });
});
