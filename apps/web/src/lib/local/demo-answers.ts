import { instruments } from '@anabokra/content';

/**
 * A plausible "scientist" answer set for every station, varied a little so the straight-lining
 * check stays quiet. Used by tests and the /dev/local check page.
 */
const wobble = (i: number) => (i % 7 === 0 ? 1 : i % 5 === 0 ? -1 : 0);
const clamp = (v: number) => Math.min(5, Math.max(1, v));
const likes: Record<string, number> = { R: 2, I: 5, A: 3, S: 2, E: 1, C: 3 };

export function demoStations() {
  return [
    [
      'interests',
      instruments.interests.items.map((it, i) => ({
        itemId: it.id,
        value: it.attentionCheck ? it.attentionCheck.expected : clamp(likes[it.scale!]! + wobble(i)),
        ms: 2500,
      })),
    ],
    [
      'personality',
      instruments.personality.items.map((it, i) => ({
        itemId: it.id,
        value: it.attentionCheck ? it.attentionCheck.expected : clamp((it.keyed === -1 ? 2 : 4) + wobble(i)),
        ms: 3000,
      })),
    ],
    ['values', instruments.values.cards.map((c, i) => ({ itemId: c.id, value: (i % 3) + 1, ms: 1800 }))],
    ['abilities', instruments.abilities.selfRatings.map((s, i) => ({ itemId: s.id, value: 3 + (i % 3), ms: 2000 }))],
  ] as const;
}
