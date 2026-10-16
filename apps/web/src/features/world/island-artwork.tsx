'use client';

import type { GroupId } from './types';

const COLUMNS = 4;
const ROWS = 3;

/** The 12 groups drawn in the atlas, in its order (the atlas predates the six groups added in Oct 2026). */
const ATLAS: readonly GroupId[] = ['tech', 'science', 'health', 'agriculture', 'tourism', 'education', 'law', 'business', 'media', 'creative', 'engineering', 'trades'];

/** The six groups added in Oct 2026, drawn in a second 3×2 atlas (prompt: docs/art/README.md, "Island atlas"). */
const ATLAS_2: readonly GroupId[] = ['sports', 'transport', 'beauty', 'security', 'religion', 'performing'];
/** Set to true once public/world/career-islands-atlas-2.webp is in place. */
const HAS_ATLAS_2 = false;

/** Until the second atlas exists, newer groups show a soft tile with a symbol instead of artwork. */
const FALLBACK: Partial<Record<GroupId, string>> = { sports: '⚽', transport: '✈️', beauty: '💇', security: '🛡️', religion: '🕊️', performing: '🎭' };

function cell(id: GroupId) {
  const first = ATLAS.indexOf(id);
  if (first !== -1) return { url: '/world/career-islands-atlas.webp', index: first, columns: COLUMNS, rows: ROWS };
  const second = HAS_ATLAS_2 ? ATLAS_2.indexOf(id) : -1;
  return second === -1 ? null : { url: '/world/career-islands-atlas-2.webp', index: second, columns: 3, rows: 2 };
}

/** Displays one cell from the generated island artwork atlases. */
export function IslandArtwork({ id, className = '' }: { id: GroupId; className?: string }) {
  const at = cell(id);
  if (!at)
    return (
      <div aria-hidden="true" className={`grid shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-[#FFF5E6] via-[#E6F1EE] to-[#EAE0F3] text-6xl ${className}`}>
        {FALLBACK[id] ?? '🏝️'}
      </div>
    );
  const column = at.index % at.columns;
  const row = Math.floor(at.index / at.columns);

  return (
    <div
      aria-hidden="true"
      className={`shrink-0 bg-no-repeat ${className}`}
      style={{
        backgroundImage: `url('${at.url}')`,
        backgroundSize: `${at.columns * 100}% ${at.rows * 100}%`,
        backgroundPosition: `${(column / (at.columns - 1)) * 100}% ${(row / (at.rows - 1)) * 100}%`,
      }}
    />
  );
}
