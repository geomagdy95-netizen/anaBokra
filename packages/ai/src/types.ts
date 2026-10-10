import type { CareerMatch, I18n } from '@anabokra/engine';

export type Locale = 'ar' | 'en';
/** Only affects Arabic wording. `neutral` falls back to the masculine default forms. */
export type Gender = 'male' | 'female' | 'neutral';
export type ExplainMode = 'template' | 'ai';

/** Minimal career shape the service needs. Structurally compatible with `Career` from @anabokra/content. */
export interface ExplainCareer {
  id: string;
  name: I18n;
  /** Optional career page snapshot (packages/content/careers/pages/*.json -> `snapshot`). */
  snapshot?: { hook?: I18n; summary?: I18n };
}

export interface CareerExplanation {
  careerId: string;
  locale: Locale;
  /** Short warm paragraph (2-3 sentences). From the model in AI mode, from templates otherwise. */
  text: string;
  /** One deterministic line per structured reason. */
  reasons: string[];
  /** One deterministic line per watch-out. */
  watchOuts: string[];
  /** One deterministic line per context flag. */
  flags: string[];
  /** `ai` = text came from the model, `cache` = AI text served from the cache, `template` = deterministic. */
  source: 'template' | 'ai' | 'cache';
}

export interface UsageRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  resultId: string;
  careerIds: string[];
  locale: Locale;
  latencyMs: number;
}

export interface ExplanationCache {
  get(key: string): Promise<string | undefined>;
  set(key: string, text: string): Promise<void>;
}

/** Subset of the Anthropic SDK client that this package uses (easy to mock). */
export interface MessagesClient {
  messages: {
    create(params: import('@anthropic-ai/sdk').Anthropic.MessageCreateParamsNonStreaming): Promise<
      import('@anthropic-ai/sdk').Anthropic.Message
    >;
  };
}

export interface ExplainDeps {
  /** Defaults to `new Anthropic()` when credentials are present; otherwise AI mode falls back to templates. */
  client?: MessagesClient;
  /** Defaults to a process-wide in-memory cache. */
  cache?: ExplanationCache;
  /** Called after every successful model call (cost logging). Errors are swallowed. */
  onUsage?: (usage: UsageRecord) => void | Promise<void>;
  /** Defaults to env ANABOKRA_AI_MODEL or `claude-sonnet-5-5`. */
  model?: string;
  /** Defaults to env ANABOKRA_ENGINE_VERSION or `engine-0`. Part of the cache key. */
  engineVersion?: string;
}

export interface ExplainInput {
  matches: CareerMatch[];
  careers: ExplainCareer[];
  locale: Locale;
  gender: Gender;
  mode: ExplainMode;
  resultId: string;
  deps?: ExplainDeps;
}
