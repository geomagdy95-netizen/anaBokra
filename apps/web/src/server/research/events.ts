/**
 * Partner sessions of the university pilot (pilot-plan "Event code"). Each has a short code, and says
 * whether that partner allows the research opt-in (some universities may need an approval first).
 */
export interface PilotEvent {
  code: string;
  partner: string;
  /** Whether the research opt-in is offered at this partner's sessions. */
  research: boolean;
  /** Codes can be entered from this day to this day (inclusive, YYYY-MM-DD); open-ended when null. */
  opensOn: string | null;
  closesOn: string | null;
}

export interface EventStore {
  readonly name: string;
  find(code: string): Promise<PilotEvent | null>;
}

export class MemoryEventStore implements EventStore {
  readonly name = 'memory';
  constructor(readonly events: PilotEvent[] = []) {}
  async find(code: string) {
    return this.events.find((e) => e.code === code) ?? null;
  }
}

/**
 * Events from PILOT_EVENTS, e.g. "CU-FCI-1:research,AUC-1" (":research" allows the research opt-in).
 * For development without a database; production reads the pilot_events table.
 */
export function eventsFromEnv(value: string | undefined): PilotEvent[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [code, flag] = s.split(':');
      return { code: code!.toUpperCase(), partner: code!.toUpperCase(), research: flag === 'research', opensOn: null, closesOn: null };
    });
}

type Query = PromiseLike<{ data: unknown; error: unknown }> & { eq(c: string, v: string): Query; maybeSingle(): Query };
export interface EventsClient {
  from(t: 'pilot_events'): { select(cols: string): Query };
}

/** Postgres table public.pilot_events (migration 20261012000001), read with the service role. */
export class SupabaseEventStore implements EventStore {
  readonly name = 'supabase';
  constructor(private readonly client: EventsClient) {}
  async find(code: string) {
    const { data, error } = await this.client.from('pilot_events').select('code, partner, research, opens_on, closes_on').eq('code', code).maybeSingle();
    if (error) throw new Error('events_store_failed');
    const r = data as { code: string; partner: string; research: boolean; opens_on: string | null; closes_on: string | null } | null;
    return r ? { code: r.code, partner: r.partner, research: r.research, opensOn: r.opens_on, closesOn: r.closes_on } : null;
  }
}
