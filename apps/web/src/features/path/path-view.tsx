'use client';

import dynamic from 'next/dynamic';
import { Component, useMemo, type ReactNode } from 'react';

import type { RendererKind } from './capabilities';
import { readPalette } from './palette';
import { PathSvg } from './path-svg';
import type { PathSceneProps } from './scene-state';

// The whole three.js stack lives behind this dynamic import: not in the first-load bundle, never SSR'd.
const PathCanvas = dynamic(() => import('./path-canvas'), {
  ssr: false,
  loading: () => <ViewPlaceholder />,
});

export function ViewPlaceholder() {
  return <div className="size-full animate-pulse bg-muted" aria-hidden="true" />;
}

class Boundary extends Component<{ onError?: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? <ViewPlaceholder /> : this.props.children;
  }
}

export interface PathViewProps extends Omit<PathSceneProps, 'palette'> {
  renderer: RendererKind;
  /** Accessible description of the scene. */
  label: string;
  reducedMotion: boolean;
  /** Called when 3D cannot run (chunk failed, render error, context lost). */
  onFailure?: () => void;
  /** Dev FPS probe: called once per rendered 3D frame. */
  onFrame?: () => void;
  /** Results reveal camera: see PathCanvasProps. Ignored by the 2D view, which always shows the whole world. */
  intro?: 'play' | 'end';
}

export function PathView({ renderer, label, reducedMotion, onFailure, onFrame, intro, ...scene }: PathViewProps) {
  // Client-only (parents only render this after capability detection), so reading CSS tokens is safe.
  const palette = useMemo(() => readPalette(), []);
  const antialias = useMemo(() => {
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    return mem === undefined || mem > 4;
  }, []);

  if (renderer === '2d') return <PathSvg {...scene} palette={palette} label={label} />;
  return (
    <div role="img" aria-label={label} className="size-full">
      <Boundary onError={onFailure}>
        <PathCanvas {...scene} palette={palette} reducedMotion={reducedMotion} antialias={antialias} onFrame={onFrame} onError={onFailure} intro={intro} />
      </Boundary>
    </div>
  );
}
