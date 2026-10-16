'use client';

import {
  BookOpen,
  Briefcase,
  Cog,
  Cpu,
  Drama,
  Dumbbell,
  FlaskConical,
  GraduationCap,
  Megaphone,
  Palette,
  Plane,
  Scale,
  Scissors,
  Shield,
  Sparkles,
  Stethoscope,
  TreePalm,
  Wheat,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

import { artGroup, artUrl, type ArtChain } from './task-art';

const ICONS: Record<string, LucideIcon> = {
  health: Stethoscope,
  engineering: Cog,
  tech: Cpu,
  business: Briefcase,
  media: Megaphone,
  creative: Palette,
  law: Scale,
  education: GraduationCap,
  science: FlaskConical,
  tourism: TreePalm,
  trades: Wrench,
  agriculture: Wheat,
  sports: Dumbbell,
  transport: Plane,
  beauty: Scissors,
  security: Shield,
  religion: BookOpen,
  performing: Drama,
  discover: Sparkles,
};

/**
 * The picture at the top of a task screen. Fills its box (the parent sets the size). Without an
 * illustration it draws a soft placeholder in the brand colours with the island's icon. Pictures are
 * decorative: the question text carries the meaning.
 */
export function TaskArt({ chain, className }: { chain?: ArtChain; className?: string }) {
  const src = artUrl(chain);
  const [loaded, setLoaded] = useState<string | null>(null);
  const Icon = ICONS[artGroup(chain)] ?? Sparkles;
  return (
    <div className={cn('relative overflow-hidden bg-brand-lavender/40', className)} data-testid="task-art" data-art={src ? 'image' : 'placeholder'}>
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(120%_80%_at_80%_10%,var(--brand-orange-soft),transparent_60%),radial-gradient(100%_90%_at_10%_90%,var(--brand-violet-soft),transparent_65%)]">
        <div className="absolute -end-10 top-8 size-48 rounded-full bg-white/35" />
        <div className="absolute -start-14 bottom-10 size-56 rounded-full bg-white/25" />
        <div className="absolute inset-0 flex items-center justify-center pb-8">
          <span className="flex size-24 items-center justify-center rounded-[2rem] bg-white/70 text-brand-violet shadow-lg shadow-brand-violet/10 backdrop-blur-sm">
            <Icon className="size-12" strokeWidth={1.6} />
          </span>
        </div>
      </div>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- static WebP from /public, already sized by art:build
        <img
          key={src}
          src={src}
          alt=""
          decoding="async"
          onLoad={() => setLoaded(src)}
          // Server-rendered pages can finish loading the image before hydration attaches onLoad.
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0) setLoaded(src);
          }}
          className={cn('absolute inset-0 size-full object-cover transition-opacity duration-300', loaded === src ? 'opacity-100' : 'opacity-0')}
        />
      )}
    </div>
  );
}
