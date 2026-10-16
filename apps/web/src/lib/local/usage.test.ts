// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { clearFinishedUsage, dropUsage, finishedUsage, track, trackView, viewedCareers } from './usage';

beforeEach(() => window.localStorage.clear());

const day = (d: string) => new Date(`${d}T10:00:00Z`);

describe('usage counts', () => {
  it('counts today, then hands earlier days over for sending while today keeps counting', () => {
    track('map_island', day('2026-10-16'));
    track('map_island', day('2026-10-16'));
    expect(finishedUsage(day('2026-10-16'))).toBeNull();
    track('dock_results', day('2026-10-17'));
    expect(finishedUsage(day('2026-10-17'))).toEqual({ day: '2026-10-16', counts: { map_island: 2 } });
    clearFinishedUsage(day('2026-10-17'));
    expect(finishedUsage(day('2026-10-17'))).toBeNull();
    expect(finishedUsage(day('2026-10-18'))).toEqual({ day: '2026-10-17', counts: { dock_results: 1 } });
  });

  it('notes each career page once, and drops everything when statistics are off', () => {
    trackView('pharmacist');
    trackView('pharmacist');
    trackView('nurse');
    expect(viewedCareers()).toEqual(['pharmacist', 'nurse']);
    track('map_zoom', day('2026-10-15'));
    dropUsage();
    expect(viewedCareers()).toEqual([]);
    expect(finishedUsage(day('2026-10-20'))).toBeNull();
  });
});
