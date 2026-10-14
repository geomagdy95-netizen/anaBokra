'use client';

import { GROUP_ORDER, type GroupId } from './types';

const COLUMNS = 4;
const ROWS = 3;

/** Displays one cell from the generated 4×3 island artwork atlas. */
export function IslandArtwork({ id, className = '' }: { id: GroupId; className?: string }) {
  const index = GROUP_ORDER.indexOf(id);
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);

  return (
    <div
      aria-hidden="true"
      className={`shrink-0 bg-no-repeat ${className}`}
      style={{
        backgroundImage: "url('/world/career-islands-atlas.webp')",
        backgroundSize: `${COLUMNS * 100}% ${ROWS * 100}%`,
        backgroundPosition: `${(column / (COLUMNS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`,
      }}
    />
  );
}
