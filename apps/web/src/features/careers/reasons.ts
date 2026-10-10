import type { Riasec } from '@anabokra/engine';

/** Structured reason / watch-out from the engine, as serialised in PersonalFit. */
export type ReasonLike = { kind: string; [k: string]: unknown };

type T = (key: string, values?: Record<string, string | number>) => string;

/** Turns an engine reason into a sentence. Unknown kinds are skipped (null). Wording is gender-neutral for Arabic. */
export function reasonText(r: ReasonLike, t: T): string | null {
  switch (r.kind) {
    case 'interest': {
      const types = ((r.types as Riasec[] | undefined) ?? []).map((k) => t(`riasec.${k}`));
      return types.length ? t('reasons.interest', { types: types.join(' / ') }) : null;
    }
    case 'personality':
      return t('reasons.personality', { trait: t(`traits.${String(r.trait)}`) });
    case 'value':
      return t('reasons.value', { value: t(`workValues.${String(r.value)}`) });
    case 'ability':
      return t('reasons.ability', { domain: t(`abilities.${String(r.domain)}`) });
    default:
      return null;
  }
}

export function watchOutText(w: ReasonLike, t: T): string | null {
  switch (w.kind) {
    case 'personalityStretch':
      return t('watchOuts.personalityStretch', { trait: t(`traits.${String(w.trait)}`) });
    case 'abilityGap':
      return t('watchOuts.abilityGap', { domain: t(`abilities.${String(w.domain)}`) });
    default:
      return null;
  }
}
