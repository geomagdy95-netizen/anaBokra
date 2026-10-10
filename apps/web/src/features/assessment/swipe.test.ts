import { describe, expect, it } from 'vitest';

import { resolveSwipe, SWIPE_THRESHOLD_PX, SWIPE_VALUE, valueForSwipe } from './swipe';

describe('swipe -> value mapping', () => {
  it('is left=2, right=4, up=5', () => {
    expect(SWIPE_VALUE).toEqual({ left: 2, right: 4, up: 5 });
    expect(valueForSwipe('left')).toBe(2);
    expect(valueForSwipe('right')).toBe(4);
    expect(valueForSwipe('up')).toBe(5);
  });

  it('resolves drags to directions (physical, also in RTL)', () => {
    expect(resolveSwipe(-120, 10)).toBe('left');
    expect(resolveSwipe(120, -10)).toBe('right');
    expect(resolveSwipe(5, -120)).toBe('up');
  });

  it('ignores short drags and downward drags', () => {
    expect(resolveSwipe(SWIPE_THRESHOLD_PX - 1, 0)).toBeNull();
    expect(resolveSwipe(0, -(SWIPE_THRESHOLD_PX - 1))).toBeNull();
    expect(resolveSwipe(0, 200)).toBeNull();
    expect(resolveSwipe(0, 0)).toBeNull();
  });

  it('lets the dominant axis win on diagonals', () => {
    expect(resolveSwipe(-100, -60)).toBe('left');
    expect(resolveSwipe(60, -100)).toBe('up');
  });
});
