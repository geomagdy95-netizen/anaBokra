/**
 * D2 interests: swipe direction -> stored answer on the 1..5 scale.
 *
 * ONE source of truth for the mapping. Directions are PHYSICAL screen directions (also in RTL),
 * because a swipe is a physical gesture and the arrow keys mirror it. Values 1 and 3 have no
 * gesture: they are on the always-visible buttons (and keys 1..5).
 *
 *   left  -> 2  (Dislike)
 *   right -> 4  (Like)
 *   up    -> 5  (Strongly like)
 *   down  -> nothing (the card snaps back)
 */
export const SWIPE_VALUE = { left: 2, right: 4, up: 5 } as const;

export type SwipeDirection = keyof typeof SWIPE_VALUE;
export type SwipeValue = (typeof SWIPE_VALUE)[SwipeDirection];

/** Minimum drag distance (px) that counts as a swipe. */
export const SWIPE_THRESHOLD_PX = 80;

/** Keyboard equivalents of the three swipes. */
export const SWIPE_KEYS: Record<string, SwipeDirection> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
};

/** Which swipe (if any) a drag of (dx, dy) pixels is. The dominant axis wins; only "up" counts on the vertical axis. */
export function resolveSwipe(dx: number, dy: number, threshold: number = SWIPE_THRESHOLD_PX): SwipeDirection | null {
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (Math.abs(dx) < threshold) return null;
    return dx < 0 ? 'left' : 'right';
  }
  return dy <= -threshold ? 'up' : null;
}

export const valueForSwipe = (d: SwipeDirection): SwipeValue => SWIPE_VALUE[d];
