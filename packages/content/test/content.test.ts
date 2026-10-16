import { describe, expect, it } from 'vitest';
import { ABILITY_DOMAINS, BIG_FIVE, RIASEC, WORK_VALUES } from '@anabokra/engine';
import { careers, clusters, instruments } from '../src';

const scored = <T extends { attentionCheck?: unknown }>(items: T[]) => items.filter((i) => !i.attentionCheck);

describe('instruments', () => {
  it('interests: 60 O*NET items, 10 per RIASEC type', () => {
    const items = scored(instruments.interests.items);
    expect(items).toHaveLength(60);
    for (const k of RIASEC) expect(items.filter((i) => i.scale === k)).toHaveLength(10);
  });

  it('personality: IPIP-50 with the published key (+/- items per factor)', () => {
    const items = scored(instruments.personality.items);
    expect(items).toHaveLength(50);
    const expected: Record<string, [number, number]> = {
      extraversion: [5, 5],
      agreeableness: [6, 4],
      conscientiousness: [6, 4],
      emotionalStability: [2, 8],
      intellect: [7, 3],
    };
    for (const f of BIG_FIVE) {
      const fi = items.filter((i) => i.scale === f);
      expect([fi.filter((i) => i.keyed === 1).length, fi.filter((i) => i.keyed === -1).length]).toEqual(expected[f]);
    }
  });

  it('values: 21 cards covering all six O*NET work values', () => {
    expect(instruments.values.cards).toHaveLength(21);
    for (const v of WORK_VALUES) expect(instruments.values.cards.some((c) => c.value === v)).toBe(true);
  });

  it('abilities: two self-ratings per domain', () => {
    for (const d of ABILITY_DOMAINS) expect(instruments.abilities.selfRatings.filter((s) => s.domain === d)).toHaveLength(2);
  });

  it('every item has unique id and both English and Arabic text', () => {
    const all = [
      ...instruments.interests.items,
      ...instruments.personality.items,
      ...instruments.readiness.items,
      ...instruments.values.cards,
      ...instruments.abilities.selfRatings,
    ];
    expect(new Set(all.map((i) => i.id)).size).toBe(all.length);
    for (const i of all) {
      expect(i.text.en.trim(), i.id).not.toBe('');
      expect(i.text.ar.trim(), i.id).not.toBe('');
    }
  });
});

describe('careers', () => {
  it('has 130 careers in known clusters with unique ids', () => {
    expect(careers).toHaveLength(130);
    expect(new Set(careers.map((c) => c.id)).size).toBe(130);
    const ids = new Set(clusters.map((c) => c.id));
    for (const c of careers) expect(ids.has(c.cluster), c.id).toBe(true);
  });

  it('has complete trait profiles within expected ranges', () => {
    for (const c of careers) {
      const t = c.traits;
      for (const k of RIASEC) expect(t.riasec[k], `${c.id} ${k}`).toBeGreaterThanOrEqual(1), expect(t.riasec[k]).toBeLessThanOrEqual(7);
      for (const f of BIG_FIVE) expect(Math.abs(t.personality[f]), `${c.id} ${f}`).toBeLessThanOrEqual(1);
      for (const v of WORK_VALUES) expect(t.values[v], `${c.id} ${v}`).toBeGreaterThanOrEqual(0), expect(t.values[v]).toBeLessThanOrEqual(1);
      for (const d of ABILITY_DOMAINS) {
        expect(t.abilities[d].level, `${c.id} ${d}`).toBeGreaterThanOrEqual(0);
        expect(t.abilities[d].level).toBeLessThanOrEqual(1);
        expect(t.abilities[d].importance).toBeGreaterThanOrEqual(0);
        expect(t.abilities[d].importance).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('short personality set (Mini-IPIP)', () => {
  it('has 4 items per trait, all from the full set, with the same keys', async () => {
    const { personalityShort } = await import('../src');
    const short = personalityShort();
    expect(short.items).toHaveLength(20);
    for (const f of BIG_FIVE) expect(short.items.filter((i) => i.scale === f)).toHaveLength(4);
    const full = new Map(instruments.personality.items.map((i) => [i.id, i]));
    for (const i of short.items) expect(full.get(i.id)).toEqual(i);
    expect(short.items.some((i) => i.attentionCheck)).toBe(false);
  });
});
