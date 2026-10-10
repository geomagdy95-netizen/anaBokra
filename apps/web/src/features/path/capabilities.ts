'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';

export type RendererKind = '3d' | '2d';
export type FallbackReason = 'no-webgl' | 'reduced-motion' | 'low-end' | 'user' | 'error';

interface DeviceCaps {
  webgl: boolean;
  lowEnd: boolean;
}

export function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext(); // free the probe context right away
    return true;
  } catch {
    return false;
  }
}

let cached: DeviceCaps | null = null;
function getCaps(): DeviceCaps {
  if (!cached) {
    const nav = navigator as Navigator & { deviceMemory?: number };
    cached = {
      webgl: detectWebGL(),
      lowEnd: (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) || (nav.hardwareConcurrency ?? 8) <= 2,
    };
  }
  return cached;
}

const noopSubscribe = () => () => {};
const getServerCaps = (): DeviceCaps | null => null;

const RM_QUERY = '(prefers-reduced-motion: reduce)';
function subscribeReduced(cb: () => void): () => void {
  const mq = window.matchMedia(RM_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
const getReduced = () => window.matchMedia(RM_QUERY).matches;

/**
 * Chooses 3D vs 2D. 2D is automatic when WebGL is missing, the user prefers reduced motion,
 * or the device looks weak (deviceMemory <= 2 / <= 2 cores). An explicit user choice wins
 * (except 3D without WebGL). A runtime 3D failure (context lost, chunk error) forces 2D.
 */
export function useRenderer() {
  const caps = useSyncExternalStore(noopSubscribe, getCaps, getServerCaps);
  const reducedMotion = useSyncExternalStore(subscribeReduced, getReduced, () => false);
  const [choice, setChoice] = useState<RendererKind | null>(null);
  const [failed, setFailed] = useState(false);
  const reportFailure = useCallback(() => setFailed(true), []);

  let renderer: RendererKind = '3d';
  let reason: FallbackReason | null = null;
  if (caps) {
    if (failed) [renderer, reason] = ['2d', 'error'];
    else if (!caps.webgl) [renderer, reason] = ['2d', 'no-webgl'];
    else if (choice) [renderer, reason] = [choice, choice === '2d' ? 'user' : null];
    else if (reducedMotion) [renderer, reason] = ['2d', 'reduced-motion'];
    else if (caps.lowEnd) [renderer, reason] = ['2d', 'low-end'];
  }

  const choose = useCallback((k: RendererKind) => {
    setFailed(false);
    setChoice(k);
  }, []);

  return { ready: caps !== null, webgl: caps?.webgl ?? false, reducedMotion, renderer, reason, choose, reportFailure };
}
