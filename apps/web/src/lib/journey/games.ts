import type { AbilityDomain } from '@anabokra/engine';

import { GAME_ABILITY, normGroup, standing, type AgeBand, type GameNorms, type RankedGame } from '@/features/games/score';
import type { KvStore } from '@/lib/local/kv';

import { journeyKey, readJourney, type JourneyDoc } from './verify';

/**
 * Games in Discover (docs/product/games.md): which task holds which game, the first full play of
 * each (kept on the phone with the journey, so it moves with a backup and is deleted with the
 * profile), the score spread for comparisons (cached on the phone), and the standings that feed the
 * ability scores.
 */

export type GameId = RankedGame | 'patience';

/** Discover task number → the game played after its questions. */
export const DISCOVER_GAMES: Readonly<Record<number, GameId>> = { 3: 'pattern', 5: 'numbers', 6: 'patience', 7: 'rotation', 8: 'memory' };

/** The step id of a game in its task (also what marks it done). */
export const gameStepId = (game: GameId) => `game_${game}`;

export interface GameRecord {
  /** When the first full play ended (ISO). */
  at: string;
  /** Points for the comparison (choice games: right answers weighted by level; memory: span). 0 for patience. */
  points: number;
  /** What the player saw: right answers (of 8), the longest path, or waits completed (of 6). */
  shown: number;
  of: number;
  timeMs?: number;
  timedOut?: boolean;
}

/** Saves a game's first full play; later plays don't replace it (only the first counts). */
export async function saveGame(kv: KvStore, profileId: string, game: GameId, record: GameRecord): Promise<boolean> {
  const doc = await readJourney(kv, profileId);
  if (doc.games?.[game]) return false;
  await kv.set(journeyKey(profileId), { ...doc, games: { ...doc.games, [game]: record } });
  return true;
}

/** Step ids of the games played, to count with the answered questions. */
export const playedGameSteps = (journey: JourneyDoc): string[] => Object.keys(journey.games ?? {}).map((g) => gameStepId(g as GameId));

// --- Comparison data ------------------------------------------------------------------

const NORMS_KEY = 'games:norms';
const NORMS_MAX_AGE = 24 * 60 * 60 * 1000;

interface CachedNorms {
  at: number;
  norms: GameNorms;
}

export async function cachedNorms(kv: KvStore): Promise<GameNorms | null> {
  return (await kv.get<CachedNorms>(NORMS_KEY))?.norms ?? null;
}

/** Fetches the score spread at most once a day; keeps the last copy for offline use. Never throws. */
export async function refreshNorms(kv: KvStore, now = Date.now(), get: () => Promise<GameNorms | null> = fetchNorms): Promise<GameNorms | null> {
  const cached = await kv.get<CachedNorms>(NORMS_KEY);
  if (cached && now - cached.at < NORMS_MAX_AGE) return cached.norms;
  try {
    const norms = await get();
    if (norms) {
      await kv.set(NORMS_KEY, { at: now, norms });
      return norms;
    }
  } catch {
    // Offline or server down: use what we have.
  }
  return cached?.norms ?? null;
}

async function fetchNorms(): Promise<GameNorms | null> {
  const res = await fetch('/api/stats/norms');
  if (!res.ok) return null;
  return ((await res.json()) as { norms?: GameNorms }).norms ?? null;
}

/**
 * Per ability, where the player's first play stands among comparable players (0–1). Only games with
 * enough players count; without them the ability keeps its self-rating alone.
 */
export function abilityStandings(journey: JourneyDoc, norms: GameNorms | null, ageBand: AgeBand | null): Partial<Record<AbilityDomain, number>> {
  const out: Partial<Record<AbilityDomain, number>> = {};
  for (const [game, domain] of Object.entries(GAME_ABILITY) as [RankedGame, AbilityDomain][]) {
    const rec = journey.games?.[game];
    const group = rec ? normGroup(norms, game, ageBand) : null;
    if (rec && group) out[domain] = Math.round(standing(rec.points, group.hist) * 1000) / 1000;
  }
  return out;
}

/** The profile's age band as the comparison uses it (none under 15). */
export const comparisonBand = (band: string | null | undefined): AgeBand | null =>
  band === '15-17' || band === '18-20' || band === '21-25' || band === '26plus' ? band : null;
