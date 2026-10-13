import { describe, expect, it } from 'vitest';

import { hiddenRouteRedirect } from './hidden-routes';

const local = { mode: 'local' as const, production: true };
const server = { mode: 'server' as const, production: true };

describe('hiddenRouteRedirect', () => {
  it('sends phase 2 screens to the app in phase 1', () => {
    for (const p of ['/ar/careers', '/en/careers/', '/ar/careers/compare', '/ar/careers/favorites', '/en/explore', '/ar/explore/programs/x', '/ar/login', '/ar/parents', '/ar/schools', '/ar/try', '/ar/admin/users', '/ar/consent/abc', '/ar/family/settings', '/ar/school/join'])
      expect(hiddenRouteRedirect(p, local)).toBe(`/${p.slice(1, 3)}/journey`);
  });

  it('keeps the app, the career page, legal pages and the landing page', () => {
    for (const p of ['/ar', '/en/', '/ar/journey', '/ar/journey/map', '/ar/careers/software-engineer', '/ar/legal/privacy-policy', '/ar/assessment/result', '/ar/explorer'])
      expect(hiddenRouteRedirect(p, local)).toBeNull();
  });

  it('uses the default locale when the path has none', () => {
    expect(hiddenRouteRedirect('/explore', local)).toBe('/ar/journey');
  });

  it('serves every screen in server mode, except developer pages in production', () => {
    expect(hiddenRouteRedirect('/ar/explore', server)).toBeNull();
    expect(hiddenRouteRedirect('/en/dev/world', server)).toBe('/en/journey');
    expect(hiddenRouteRedirect('/en/dev/world', { mode: 'local', production: false })).toBeNull();
  });
});
