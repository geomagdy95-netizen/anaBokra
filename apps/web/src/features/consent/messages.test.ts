import { describe, expect, it } from 'vitest';

import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { CONSENT_CHECKS, FAMILY_CHECK } from '@/server/consent/constants';

const keys = (o: unknown, prefix = ''): string[] =>
  o && typeof o === 'object' && !Array.isArray(o)
    ? Object.entries(o).flatMap(([k, v]) => keys(v, `${prefix}${k}.`))
    : [prefix.slice(0, -1)];

describe('Consent messages', () => {
  it('have the same keys in Arabic and English', () => {
    expect(keys(ar.Consent).sort()).toEqual(keys(en.Consent).sort());
  });

  it('have a text for every checkbox, in both languages', () => {
    for (const id of [...CONSENT_CHECKS, FAMILY_CHECK]) {
      expect((en.Consent.checks as Record<string, string>)[id]).toBeTruthy();
      expect((ar.Consent.checks as Record<string, string>)[id]).toBeTruthy();
    }
  });

  it('keep the same {placeholders} in both languages (so no message loses a variable)', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]).sort();
    const flat = (o: unknown, p = ''): [string, string][] =>
      typeof o === 'string' ? [[p, o]] : o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => flat(v, `${p}.${k}`)) : [];
    const enMap = new Map(flat(en.Consent));
    for (const [k, v] of flat(ar.Consent)) expect({ k, v: vars(v) }).toEqual({ k, v: vars(enMap.get(k) ?? '') });
  });
});
