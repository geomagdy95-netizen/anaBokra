import type { ResearchAnswerSet, ResearchPathSet, ResearchReadiness } from '@/lib/research';

/** What is kept: the upload plus the ISO week it arrived in. No IP address, exact time or user id. */
export type AnswerSetRecord = ResearchAnswerSet & { receivedWeek: string };
export type PathSetRecord = ResearchPathSet & { receivedWeek: string };
export type ReadinessResearchRecord = ResearchReadiness & { receivedWeek: string };

export interface ResearchStore {
  readonly name: string;
  addAnswerSet(r: AnswerSetRecord): Promise<void>;
  addPathSet(r: PathSetRecord): Promise<void>;
  /** One record per (link code, phase): a resend replaces it. */
  upsertReadiness(r: ReadinessResearchRecord): Promise<void>;
  /** Deletes the readiness records sent with this link code; returns how many. */
  forget(linkCode: string): Promise<number>;
}

export class MemoryResearchStore implements ResearchStore {
  readonly name = 'memory';
  readonly answerSets: AnswerSetRecord[] = [];
  readonly pathSets: PathSetRecord[] = [];
  readonly readiness: ReadinessResearchRecord[] = [];
  async addAnswerSet(r: AnswerSetRecord) {
    this.answerSets.push(structuredClone(r));
  }
  async addPathSet(r: PathSetRecord) {
    this.pathSets.push(structuredClone(r));
  }
  async upsertReadiness(r: ReadinessResearchRecord) {
    const i = this.readiness.findIndex((x) => x.linkCode === r.linkCode && x.phase === r.phase);
    if (i >= 0) this.readiness[i] = structuredClone(r);
    else this.readiness.push(structuredClone(r));
  }
  async forget(linkCode: string) {
    const before = this.readiness.length;
    this.readiness.splice(0, this.readiness.length, ...this.readiness.filter((x) => x.linkCode !== linkCode));
    return before - this.readiness.length;
  }
}

type Result = PromiseLike<{ error: unknown; count?: number | null }>;
export interface ResearchClient {
  from(t: 'research_answer_sets' | 'research_path_sets'): { insert(row: Record<string, unknown>): Result };
  from(t: 'research_readiness'): {
    upsert(row: Record<string, unknown>, opts: { onConflict: string }): Result;
    delete(opts: { count: 'exact' }): { eq(c: string, v: string): Result };
  };
}

/** Tables research_answer_sets and research_readiness (migration 20261012000001), service role only. */
export class SupabaseResearchStore implements ResearchStore {
  readonly name = 'supabase';
  constructor(private readonly client: ResearchClient) {}
  async addAnswerSet(r: AnswerSetRecord) {
    const { error } = await this.client.from('research_answer_sets').insert({
      received_week: r.receivedWeek,
      event_code: r.eventCode,
      age_band: r.ageBand,
      stage: r.stage,
      locale: r.locale,
      versions: r.versions,
      answers: r.answers,
      values_ranking: r.valuesRanking,
    });
    if (error) throw new Error('research_store_failed');
  }
  async addPathSet(r: PathSetRecord) {
    const { error } = await this.client.from('research_path_sets').insert({
      received_week: r.receivedWeek,
      event_code: r.eventCode,
      age_band: r.ageBand,
      stage: r.stage,
      locale: r.locale,
      path_id: r.pathId,
      version: r.version,
      answers: r.answers,
      components: r.components,
      band: r.band,
    });
    if (error) throw new Error('research_store_failed');
  }
  async upsertReadiness(r: ReadinessResearchRecord) {
    const { error } = await this.client.from('research_readiness').upsert(
      {
        link_code: r.linkCode,
        phase: r.phase,
        received_week: r.receivedWeek,
        event_code: r.eventCode,
        version: r.version,
        locale: r.locale,
        answers: r.answers,
      },
      { onConflict: 'link_code,phase' },
    );
    if (error) throw new Error('research_store_failed');
  }
  async forget(linkCode: string) {
    const { error, count } = await this.client.from('research_readiness').delete({ count: 'exact' }).eq('link_code', linkCode);
    if (error) throw new Error('research_store_failed');
    return count ?? 0;
  }
}
