import type { Relation } from './types';

/** Small bridge swatch for the legend and list rows. */
export function BridgeSwatch({ relation, broken = false }: { relation: Relation; broken?: boolean }) {
  const color = relation === 'suggested' ? '#8B45DA' : relation === 'added' ? '#FF9A55' : '#E2CDA9';
  if (broken)
    return (
      <span className="flex items-center gap-1" aria-hidden>
        <span className="h-2 w-3 rounded-sm bg-[#E5DACB]" />
        <span className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1 rounded-full bg-[#9D73DB]" />
          ))}
        </span>
        <span className="h-2 w-3 rounded-sm bg-[#E5DACB]" />
      </span>
    );
  return <span className="h-2 w-10 rounded-full" style={{ background: color, boxShadow: relation === 'neutral' ? undefined : `0 0 10px ${color}` }} aria-hidden />;
}
