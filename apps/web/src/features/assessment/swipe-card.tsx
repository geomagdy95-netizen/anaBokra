'use client';

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { FOCUS } from './primitives';
import { resolveSwipe, SWIPE_THRESHOLD_PX, SWIPE_VALUE, valueForSwipe, type SwipeDirection } from './swipe';

interface Drag {
  id: number;
  x0: number;
  y0: number;
}

/**
 * The draggable card of D2. Pointer events (mouse, touch, pen): the card follows the finger; on
 * release `resolveSwipe` turns the drag into left / right / up, which `SWIPE_VALUE` turns into an
 * answer. Anything else snaps back. The buttons and keys in the parent do the same without dragging.
 */
export function SwipeCard({
  children,
  hintFor,
  onSwipe,
  disabled,
  ariaLabel,
}: {
  children: ReactNode;
  /** Short label of the answer a direction would give (shown while dragging). */
  hintFor: (value: number) => string;
  onSwipe: (value: number, direction: SwipeDirection) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const drag = useRef<Drag | null>(null);
  const [offset, setOffset] = useState({ dx: 0, dy: 0 });

  const dir = resolveSwipe(offset.dx, offset.dy, SWIPE_THRESHOLD_PX);
  const nearDir = resolveSwipe(offset.dx, offset.dy, SWIPE_THRESHOLD_PX / 3);
  const dragging = offset.dx !== 0 || offset.dy !== 0;

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setOffset({ dx: e.clientX - d.x0, dy: e.clientY - d.y0 });
  };
  const end = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    setOffset({ dx: 0, dy: 0 });
    if (cancelled) return;
    const direction = resolveSwipe(dx, dy);
    if (direction) onSwipe(valueForSwipe(direction), direction);
  };

  const hintDir = nearDir ?? null;
  return (
    <div
      role="group"
      aria-roledescription="swipeable card"
      tabIndex={0}
      aria-label={ariaLabel}
      data-testid="swipe-card"
      data-swipe={dir ?? undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={(e) => end(e, false)}
      onPointerCancel={(e) => end(e, true)}
      style={{
        touchAction: 'none',
        transform: dragging ? `translate(${offset.dx}px, ${offset.dy}px) rotate(${offset.dx / 20}deg)` : undefined,
      }}
      className={cn(
        'relative flex min-h-48 select-none items-center justify-center rounded-2xl border-2 bg-card p-6 text-center shadow-sm',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200',
        dragging ? 'cursor-grabbing' : 'cursor-grab motion-safe:transition-transform',
        dir ? 'border-primary' : 'border-border',
        FOCUS,
      )}
    >
      <p className="text-xl font-semibold leading-snug text-card-foreground sm:text-2xl">{children}</p>
      {hintDir && (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute start-1/2 top-3 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground rtl:translate-x-1/2',
          )}
          style={{ opacity: dir ? 1 : 0.6 }}
        >
          {hintFor(SWIPE_VALUE[hintDir])}
        </span>
      )}
    </div>
  );
}
