import { abilitiesInstrument, likert, valuesInstrument, type InstrumentId, type StationId } from './config';

/** What a stored value means and which values are legal, for one item. */
export interface ItemSpec {
  id: string;
  instrumentId: InstrumentId;
  /** `integer`: whole numbers in [min, max]; `enum`: one of `allowed`. */
  rule: { type: 'integer'; min: number; max: number } | { type: 'enum'; allowed: number[] };
}

export interface StationItems {
  instrumentId: Exclude<InstrumentId, 'readiness'>;
  specs: Map<string, ItemSpec>;
  /** Items the progress bar counts (everything the user is asked). */
  expected: number;
}

const cache = new Map<StationId, StationItems>();

/** Item catalog of a station, derived from @anabokra/content (single source of truth). */
export function stationItems(station: Exclude<StationId, 'context'>): StationItems {
  const hit = cache.get(station);
  if (hit) return hit;
  const specs = new Map<string, ItemSpec>();
  const add = (s: ItemSpec) => specs.set(s.id, s);

  if (station === 'interests' || station === 'personality') {
    const ins = likert(station);
    const { min, max } = ins.responseScale;
    for (const i of ins.items) add({ id: i.id, instrumentId: station, rule: { type: 'integer', min, max } });
  } else if (station === 'values') {
    const inst = valuesInstrument();
    const allowed = inst.buckets.map((b) => b.weight);
    for (const c of inst.cards) add({ id: c.id, instrumentId: 'values', rule: { type: 'enum', allowed } });
    // The dream job budget (the other way to answer): coins per work value.
    for (const b of inst.budget?.items ?? []) add({ id: b.id, instrumentId: 'values', rule: { type: 'integer', min: 0, max: inst.budget!.coins } });
  } else {
    const ab = abilitiesInstrument();
    const { min, max } = ab.selfRatingScale;
    for (const s of ab.selfRatings) add({ id: s.id, instrumentId: 'abilities', rule: { type: 'integer', min, max } });
    // Performance items: the stored value is the chosen option index.
    for (const p of ab.performance)
      add({ id: p.id, instrumentId: 'abilities', rule: { type: 'integer', min: 0, max: p.options.length - 1 } });
  }
  // A values session answers the cards or the budget, never both: the bar counts the cards.
  const expected = station === 'values' ? valuesInstrument().cards.length : specs.size;
  const out: StationItems = { instrumentId: station, specs, expected };
  cache.set(station, out);
  return out;
}

/** responses.unique(session_id, item_id) needs ids to be unique across all instruments. */
export function allItemIdsUnique(): boolean {
  const seen = new Set<string>();
  for (const st of ['interests', 'personality', 'values', 'abilities'] as const) {
    for (const id of stationItems(st).specs.keys()) {
      if (seen.has(id)) return false;
      seen.add(id);
    }
  }
  return true;
}

