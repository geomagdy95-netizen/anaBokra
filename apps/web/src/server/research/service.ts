import { instruments } from '@anabokra/content';

import { normalizeEventCode, RESEARCH_DELETE_BY, researchAnswerSetSchema, researchForgetSchema, researchReadinessSchema } from '@/lib/research';

import { stationItems } from '../assessment/items';
import { createRateLimiter, type RateLimiter } from '../rate-limit';
import { isoWeek } from '../stats/store';
import { eventsFromEnv, MemoryEventStore, type EventStore, type PilotEvent } from './events';
import { MemoryResearchStore, type ResearchStore } from './store';

export type ResearchError = 'invalid' | 'unknown_event' | 'event_closed' | 'research_not_offered' | 'research_ended' | 'rate_limited' | 'store_failed';

export class ResearchFailure extends Error {
  constructor(
    readonly code: ResearchError,
    readonly retryAfterSec?: number,
  ) {
    super(code);
  }
}

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Every answer must be a known item of its instrument, with a value that item allows. */
function answersValid(answers: Partial<Record<'interests' | 'personality' | 'values' | 'abilities', Record<string, number>>>): boolean {
  for (const [instrument, items] of Object.entries(answers) as [Parameters<typeof stationItems>[0], Record<string, number>][]) {
    const { specs } = stationItems(instrument);
    for (const [id, value] of Object.entries(items)) {
      const spec = specs.get(id);
      if (!spec) return false;
      const ok = spec.rule.type === 'integer' ? value >= spec.rule.min && value <= spec.rule.max : spec.rule.allowed.includes(value);
      if (!ok) return false;
    }
  }
  return true;
}

function readinessValid(version: string, answers: Record<string, number>): boolean {
  const inst = instruments.readiness;
  if (version !== inst.version) return false;
  const ids = inst.items.map((i) => i.id);
  const { min, max } = inst.responseScale;
  return Object.keys(answers).length === ids.length && ids.every((id) => Number.isInteger(answers[id]) && answers[id]! >= min && answers[id]! <= max);
}

/**
 * Pilot session codes and research uploads (consent-texts §2.2–2.3). Codes are checked against the
 * partner list; uploads are accepted only for a known session whose partner offers the research
 * opt-in, and only until the research deletion date. Nothing identifying is accepted or stored.
 */
export class ResearchService {
  private checks: RateLimiter;
  private uploads: RateLimiter;
  constructor(
    readonly events: EventStore,
    readonly store: ResearchStore,
    private readonly now: () => number = Date.now,
  ) {
    // Few checks per IP (stops guessing codes); uploads allow a whole room behind one university IP.
    this.checks = createRateLimiter({ limit: 20, windowMs: 60 * 60 * 1000, now: this.now });
    this.uploads = createRateLimiter({ limit: 300, windowMs: 60 * 60 * 1000, now: this.now });
  }

  /** "Joining a session?": is this a code a participant can enter today? */
  async checkEvent(rawCode: unknown, ip: string): Promise<{ code: string; research: boolean }> {
    const code = typeof rawCode === 'string' ? normalizeEventCode(rawCode) : null;
    if (!code) throw new ResearchFailure('invalid');
    const limit = await this.checks.consume(`check:${ip}`);
    if (!limit.allowed) throw new ResearchFailure('rate_limited', limit.retryAfterSec);
    const ev = await this.findEvent(code);
    const today = day(this.now());
    if ((ev.opensOn && today < ev.opensOn) || (ev.closesOn && today > ev.closesOn)) throw new ResearchFailure('event_closed');
    return { code: ev.code, research: ev.research && today <= RESEARCH_DELETE_BY };
  }

  async submitAnswerSet(body: unknown, ip: string): Promise<void> {
    const parsed = researchAnswerSetSchema.safeParse(body);
    if (!parsed.success || !answersValid(parsed.data.answers)) throw new ResearchFailure('invalid');
    await this.admit(parsed.data.eventCode, ip);
    await this.save(() => this.store.addAnswerSet({ ...parsed.data, receivedWeek: isoWeek(new Date(this.now())) }));
  }

  async submitReadiness(body: unknown, ip: string): Promise<void> {
    const parsed = researchReadinessSchema.safeParse(body);
    if (!parsed.success || !readinessValid(parsed.data.version, parsed.data.answers)) throw new ResearchFailure('invalid');
    await this.admit(parsed.data.eventCode, ip);
    await this.save(() => this.store.upsertReadiness({ ...parsed.data, receivedWeek: isoWeek(new Date(this.now())) }));
  }

  /** Deletes the readiness records sent from one phone (the link code is only on that phone). */
  async forget(body: unknown, ip: string): Promise<number> {
    const parsed = researchForgetSchema.safeParse(body);
    if (!parsed.success) throw new ResearchFailure('invalid');
    const limit = await this.uploads.consume(`upload:${ip}`);
    if (!limit.allowed) throw new ResearchFailure('rate_limited', limit.retryAfterSec);
    let n = 0;
    await this.save(async () => {
      n = await this.store.forget(parsed.data.linkCode);
    });
    return n;
  }

  private async findEvent(code: string): Promise<PilotEvent> {
    let ev: PilotEvent | null;
    try {
      ev = await this.events.find(code);
    } catch {
      throw new ResearchFailure('store_failed');
    }
    if (!ev) throw new ResearchFailure('unknown_event');
    return ev;
  }

  /** Uploads: a known event that offers research, before the deletion date. Late finishes at home are fine. */
  private async admit(code: string, ip: string) {
    const limit = await this.uploads.consume(`upload:${ip}`);
    if (!limit.allowed) throw new ResearchFailure('rate_limited', limit.retryAfterSec);
    const ev = await this.findEvent(code);
    if (!ev.research) throw new ResearchFailure('research_not_offered');
    if (day(this.now()) > RESEARCH_DELETE_BY) throw new ResearchFailure('research_ended');
  }

  private async save(fn: () => Promise<void>) {
    try {
      await fn();
    } catch {
      throw new ResearchFailure('store_failed');
    }
  }
}

const g = globalThis as typeof globalThis & { __researchService?: ResearchService };

/**
 * Supabase when the service-role key is configured; otherwise memory, with events from PILOT_EVENTS
 * (and, in development only, a DEMO-1 session that offers research).
 */
export async function getResearchService(): Promise<ResearchService> {
  if (!g.__researchService) {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const [{ createAdminClient }, events, store] = await Promise.all([import('../supabase-admin'), import('./events'), import('./store')]);
      const client = createAdminClient() as unknown;
      g.__researchService = new ResearchService(
        new events.SupabaseEventStore(client as import('./events').EventsClient),
        new store.SupabaseResearchStore(client as import('./store').ResearchClient),
      );
    } else {
      const list = eventsFromEnv(process.env.PILOT_EVENTS);
      if (process.env.NODE_ENV === 'development' && !list.some((e) => e.code === 'DEMO-1'))
        list.push({ code: 'DEMO-1', partner: 'Demo', research: true, opensOn: null, closesOn: null });
      g.__researchService = new ResearchService(new MemoryEventStore(list), new MemoryResearchStore());
    }
  }
  return g.__researchService;
}
