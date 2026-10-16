/** Bilingual text. Arabic items with gendered wording carry an optional feminine variant. */
export interface I18n {
  en: string;
  ar: string;
  arF?: string;
}

export const RIASEC = ['R', 'I', 'A', 'S', 'E', 'C'] as const;
export type Riasec = (typeof RIASEC)[number];

export const BIG_FIVE = [
  'extraversion',
  'agreeableness',
  'conscientiousness',
  'emotionalStability',
  'intellect',
] as const;
export type BigFive = (typeof BIG_FIVE)[number];

export const WORK_VALUES = [
  'achievement',
  'workingConditions',
  'recognition',
  'relationships',
  'support',
  'independence',
] as const;
export type WorkValue = (typeof WORK_VALUES)[number];

export const ABILITY_DOMAINS = ['verbal', 'numerical', 'logical', 'spatial', 'creative', 'manual'] as const;
export type AbilityDomain = (typeof ABILITY_DOMAINS)[number];

/**
 * Fields of study, grouped the way Egyptian faculties are. Used to link a student's or graduate's
 * faculty to the usual routes into a career. 'other' never matches anything.
 */
export const STUDY_FIELDS = [
  'medicine',
  'dentistry',
  'pharmacy',
  'nursing',
  'allied_health',
  'veterinary',
  'engineering',
  'computing',
  'science',
  'agriculture',
  'commerce',
  'economics_politics',
  'law',
  'arts_humanities',
  'languages',
  'mass_communication',
  'education',
  'arts',
  'tourism_archaeology',
  'technical',
  'other',
] as const;
export type StudyField = (typeof STUDY_FIELDS)[number];

export const STAGES = ['school', 'university', 'graduate'] as const;
export type Stage = (typeof STAGES)[number];

/** A score per key, every value normalized to 0..1. */
export type Scores<K extends string> = Record<K, number>;

// ---------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------

export interface InstrumentSource {
  name: string;
  url: string;
  license: string;
  notes?: string;
}

export interface ResponseScale {
  min: number;
  max: number;
  labels: I18n[];
}

export interface LikertItem {
  id: string;
  /** Scale the item loads on. Omitted for attention-check items. */
  scale?: string;
  /** +1 = higher answer means more of the trait, -1 = reverse keyed. */
  keyed?: 1 | -1;
  text: I18n;
  /**
   * A plain explanation shown on request ("what does this mean?") for items that assume knowledge.
   * It never replaces the validated wording.
   */
  hint?: I18n;
  /** Expected answer for attention-check items; such items are excluded from scoring. */
  attentionCheck?: { expected: number };
  /** Optional illustration / 3D scene key used by the UI. */
  scene?: string;
}

export interface LikertInstrument {
  id: string;
  version: string;
  kind: 'likert';
  name: I18n;
  source: InstrumentSource;
  responseScale: ResponseScale;
  scales: { id: string; name: I18n }[];
  items: LikertItem[];
}

export type ValueBucket = 'must' | 'nice' | 'no';

export interface ValueCard {
  id: string;
  value: WorkValue;
  text: I18n;
}

export interface ValuesInstrument {
  id: string;
  version: string;
  kind: 'cardSort';
  name: I18n;
  source: InstrumentSource;
  buckets: { id: ValueBucket; name: I18n; weight: number; limit?: number }[];
  cards: ValueCard[];
  /**
   * The quicker "dream job budget": `coins` to spread over the six work values, one item per value
   * (the stored answer is that value's coins). An alternative to the card sort, not an addition.
   */
  budget?: { coins: number; items: { id: string; value: WorkValue }[] };
}

export interface AbilityPerformanceItem {
  id: string;
  domain: AbilityDomain;
  prompt: I18n;
  options: I18n[];
  answerIndex: number;
  /** Optional media key (matrix image, 3D model, etc.). */
  media?: string;
}

export interface AbilitiesInstrument {
  id: string;
  version: string;
  kind: 'abilities';
  name: I18n;
  source: InstrumentSource;
  selfRatingScale: ResponseScale;
  selfRatings: { id: string; domain: AbilityDomain; text: I18n }[];
  performance: AbilityPerformanceItem[];
  /** Weight of performance items vs. self-ratings when both exist (0..1). */
  performanceWeight: number;
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export interface ItemResponse {
  itemId: string;
  value: number;
  /** Time spent on the item in milliseconds (for quality checks). */
  ms?: number;
}

// ---------------------------------------------------------------------------
// Norms
// ---------------------------------------------------------------------------

/** Population mean / SD per scale on the raw 1..5 mean metric. */
export interface Norms {
  version: string;
  group: string;
  scales: Record<string, { mean: number; sd: number }>;
}

// ---------------------------------------------------------------------------
// Careers
// ---------------------------------------------------------------------------

export interface CareerTraits {
  /** O*NET occupational interest profile, 1..7 per RIASEC type. */
  riasec: Scores<Riasec>;
  /** Relevance of each Big Five factor to performance, -1..1 (from O*NET Work Styles impact). */
  personality: Scores<BigFive>;
  /**
   * How distinctive that relevance is: percentile of the career's relevance among all O*NET
   * occupations (0..1). Used to pick traits worth mentioning; the fit itself uses `personality`.
   */
  personalityDistinct?: Scores<BigFive>;
  /** How strongly the career supplies each work value, 0..1 (percentile among all O*NET occupations). */
  values: Scores<WorkValue>;
  /** Required level (percentile among occupations) and importance (0..1) per ability domain. */
  abilities: Record<AbilityDomain, { level: number; importance: number }>;
}

export interface CareerEgyptContext {
  /** Accepted secondary tracks, e.g. ["science"]. Empty/undefined = any. */
  tracks?: string[];
  /** Typical minimum admission score (percent) for the main faculty route. */
  typicalMinScorePct?: number;
  /** Typical cost of the main study route. */
  costLevel?: 'low' | 'medium' | 'high';
  /** Fields of study that are usual routes in. Empty/undefined = no usual field (any). */
  fields?: StudyField[];
}

export interface CareerForMatching {
  id: string;
  cluster: string;
  traits: CareerTraits;
  egypt?: CareerEgyptContext;
}

// ---------------------------------------------------------------------------
// Profile & matching
// ---------------------------------------------------------------------------

export interface UserProfile {
  interests?: Scores<Riasec>;
  personality?: Scores<BigFive>;
  values?: Scores<WorkValue>;
  abilities?: Scores<AbilityDomain>;
}

export interface UserContext {
  /** School (15–17), university or graduate. Undefined is treated as school, for older sessions. */
  stage?: Stage;
  /** University and graduate stages: field of study, and year of study or of graduation. */
  field?: StudyField;
  year?: number;
  gradYear?: number;
  curriculum?: 'thanaweya' | 'igcse' | 'american' | 'ib' | 'other';
  track?: string;
  expectedScorePct?: number;
  budget?: 'low' | 'medium' | 'high';
}

export interface MatchWeights {
  interests: number;
  personality: number;
  values: number;
  abilities: number;
}

export type Reason =
  | { kind: 'interest'; types: Riasec[]; strength: number }
  | { kind: 'personality'; trait: BigFive; strength: number }
  | { kind: 'value'; value: WorkValue; strength: number }
  | { kind: 'ability'; domain: AbilityDomain; strength: number };

export type WatchOut =
  | { kind: 'personalityStretch'; trait: BigFive }
  | { kind: 'abilityGap'; domain: AbilityDomain; gap: number };

export type ContextFlag = 'trackMismatch' | 'scoreReach' | 'costHigh' | 'fieldMatch' | 'fieldSwitch';

/** Flags that are good news (shown with the reasons), not cautions. */
export const POSITIVE_FLAGS: readonly ContextFlag[] = ['fieldMatch'];

export interface CareerMatch {
  careerId: string;
  cluster: string;
  /** Overall fit 0..100. */
  fit: number;
  /** Component scores 0..100 (only those that could be computed). */
  components: Partial<Record<keyof MatchWeights, number>>;
  /** Share of the total weight backed by data (0..1); < 1 means partial results. */
  coverage: number;
  reasons: Reason[];
  watchOuts: WatchOut[];
  flags: ContextFlag[];
}
