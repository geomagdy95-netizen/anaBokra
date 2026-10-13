'use client';

import { cn } from '@/lib/utils';

/**
 * A round character whose face follows a 1–5 answer: squeezed eyes and a frown at 1, a flat mouth at
 * 3, happy closed eyes and a big grin at 5. `level` undefined is the waiting face. Drawn in the brand
 * colours; decorative (the chosen label is always shown as text).
 */
export function MoodFace({ level, className }: { level?: number; className?: string }) {
  const l = level ?? 0;
  // Body colour warms from lilac to violet to apricot as agreement grows.
  const body = ['#CFC3E8', '#B9A1E6', '#A27DE0', '#8B45DA', '#7025B5', '#FF9A57'][l]!;
  const shade = ['#B7A8D8', '#9F84D6', '#8961CF', '#7232C4', '#5A1C96', '#F07E3B'][l]!;
  const ink = '#291137';
  const mouthY = [78, 66, 71, 78, 86, 0][l]!;

  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className={cn('overflow-visible', className)}>
      <defs>
        <radialGradient id="mood-body" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="0.35" stopColor={body} />
          <stop offset="1" stopColor={shade} />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="112" rx="34" ry="5" fill={ink} opacity="0.12" />
      <path
        d="M60 8c26 0 50 18 50 50 0 30-22 50-50 50S10 88 10 58C10 26 34 8 60 8Z"
        fill="url(#mood-body)"
        className="transition-[fill] duration-300"
      />
      {/* Cheeks */}
      {l >= 4 && (
        <g fill="#FF7A9A" opacity={l === 5 ? 0.55 : 0.35}>
          <ellipse cx="33" cy="70" rx="8" ry="5" />
          <ellipse cx="87" cy="70" rx="8" ry="5" />
        </g>
      )}
      {/* Eyes */}
      <g stroke={ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {l === 1 && (
          <>
            <path d="M36 46l10 6-10 6" />
            <path d="M84 46l-10 6 10 6" />
          </>
        )}
        {l === 5 && (
          <>
            <path d="M34 56q8-10 16 0" />
            <path d="M70 56q8-10 16 0" />
          </>
        )}
      </g>
      {(l === 0 || (l >= 2 && l <= 4)) && (
        <g fill={ink}>
          <ellipse cx="42" cy="52" rx={l === 4 ? 6 : 5} ry={l === 4 ? 7.5 : 6.5} />
          <ellipse cx="78" cy="52" rx={l === 4 ? 6 : 5} ry={l === 4 ? 7.5 : 6.5} />
          <circle cx="44" cy="49" r="2" fill="#fff" />
          <circle cx="80" cy="49" r="2" fill="#fff" />
        </g>
      )}
      {l === 2 && (
        <g stroke={ink} strokeWidth="4" strokeLinecap="round">
          <path d="M34 42l13-5" />
          <path d="M86 42l-13-5" />
        </g>
      )}
      {/* Mouth */}
      {l === 5 ? (
        <path d="M40 74h40c0 14-9 22-20 22s-20-8-20-22Z" fill={ink} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
      ) : l === 0 ? (
        <circle cx="60" cy="80" r="5" fill="none" stroke={ink} strokeWidth="4.5" />
      ) : (
        <path d={`M44 78Q60 ${2 * mouthY - 78} 76 78`} fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
      )}
      {l === 5 && <path d="M50 88q10 6 20 0" fill="#FF7A9A" />}
    </svg>
  );
}
