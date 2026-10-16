import { instruments } from '@anabokra/content';
import type { AbilitiesInstrument, LikertInstrument, UserContext, ValuesInstrument } from '@anabokra/engine';

/** Instrument-set tag stored in results.assessment_version. Bump when the set of instruments or scoring rules changes. */
export const ASSESSMENT_VERSION = '2026.2';
/** Mirrors packages/engine/package.json (checked by a test). Stored in results.engine_version. */
export const ENGINE_VERSION = '0.1.0';
/** Egyptian norms do not exist yet: scores are raw rescaled means. Stored as NULL. */
export const NORMS_VERSION: string | null = null;

export const TOP_MATCHES = 20;

/**
 * How new sessions ask two of the instruments (stored on the session, so a session keeps the format
 * it started with). `checklist`: interest cards in a grid of six, "tap the ones you'd enjoy" (tapped 5,
 * not tapped 1), close to the Interest Profiler's original checklist; `scale` is the 1–5 swipe.
 * `budget`: 10 coins over the six work values on one screen; `cards` is the 21-card sort.
 * DRAFT: the psychologist confirms both before the pilot; set `scale` / `cards` to go back.
 */
export const ANSWER_FORMATS: AnswerFormats = { interests: 'checklist', values: 'budget' };

export interface AnswerFormats {
  interests: 'scale' | 'checklist';
  values: 'cards' | 'budget';
}

/** Sessions started before formats were recorded used the original ones. */
export const LEGACY_FORMATS: AnswerFormats = { interests: 'scale', values: 'cards' };

/** Checklist answers: a tapped card is "strongly like", a card left alone "strongly dislike". */
export const CHECKLIST_VALUE = { on: 5, off: 1 } as const;
export const SURPRISING_MATCHES = 3;

export const STATION_IDS = ['interests', 'personality', 'values', 'abilities', 'context'] as const;
export type StationId = (typeof STATION_IDS)[number];

export type InstrumentId = keyof typeof instruments;

export interface StationConfig {
  id: StationId;
  /** null for the context station (stored on the profile, not an instrument). */
  instrumentId: Exclude<InstrumentId, 'readiness'> | null;
  /** Context is optional; the four instrument stations feed the matching. */
  required: boolean;
}

const ALL: StationConfig[] = [
  { id: 'interests', instrumentId: 'interests', required: true },
  { id: 'personality', instrumentId: 'personality', required: true },
  { id: 'values', instrumentId: 'values', required: true },
  { id: 'abilities', instrumentId: 'abilities', required: true },
  { id: 'context', instrumentId: null, required: false },
];

export type SessionKind = 'full' | 'quick';

/** Stations per session kind. `quick` is the consent-free taster: interests only. */
export function stationsFor(kind: SessionKind): StationConfig[] {
  return kind === 'quick' ? ALL.filter((s) => s.id === 'interests') : ALL;
}

export function stationConfig(kind: SessionKind, id: string): StationConfig | undefined {
  return stationsFor(kind).find((s) => s.id === id);
}

/** Readiness pre/post (decision-readiness outcome metric), not part of the station flow. */
export const READINESS = {
  instrumentId: 'readiness' as const,
  phases: ['pre', 'post'] as const,
};
export type ReadinessPhase = (typeof READINESS.phases)[number];

export const instrumentVersion = (id: InstrumentId): string => instruments[id].version;

/** Versions pinned on every new session (instrument id -> version). */
export function currentInstrumentVersions(kind: SessionKind): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of stationsFor(kind)) if (s.instrumentId) out[s.instrumentId] = instrumentVersion(s.instrumentId);
  return out;
}

/** Context questions asked at each stage (the stage question itself counts as one). */
export const CONTEXT_FIELDS = {
  school: ['stage', 'curriculum', 'track', 'expectedScorePct', 'budget'],
  university: ['stage', 'field', 'year', 'budget'],
  graduate: ['stage', 'field', 'gradYear', 'budget'],
  none: ['stage', 'budget'],
} as const satisfies Record<string, readonly (keyof UserContext)[]>;

export const contextFieldsFor = (ctx: UserContext | undefined): readonly (keyof UserContext)[] => CONTEXT_FIELDS[ctx?.stage ?? 'none'];

export const likert = (id: 'interests' | 'personality' | 'readiness') => instruments[id] as LikertInstrument;
export const valuesInstrument = () => instruments.values as ValuesInstrument;
export const abilitiesInstrument = () => instruments.abilities as AbilitiesInstrument;
