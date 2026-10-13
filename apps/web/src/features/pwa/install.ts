'use client';

import { useSyncExternalStore } from 'react';

/** Chrome's install prompt event (not in the DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * How the app can be added to the home screen here:
 * - `installed`: already running from the home screen;
 * - `prompt`: Chrome / Android offered its install prompt, so a button can open it;
 * - `ios`: iPhone or iPad, where it's Share → Add to Home Screen (no prompt exists);
 * - `none`: neither (desktop, or a browser that can't install apps).
 */
export type InstallMode = 'installed' | 'prompt' | 'ios' | 'none';

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
let listening = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function standalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Called once from PwaSetup, early, because Chrome fires `beforeinstallprompt` right after load. */
export function listenForInstall() {
  if (listening) return;
  listening = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep it for our own button instead of Chrome's mini bar
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    notify();
  });
}

function mode(): InstallMode {
  if (installed || standalone()) return 'installed';
  if (deferred) return 'prompt';
  return isIos() ? 'ios' : 'none';
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useInstallMode(): InstallMode {
  // On the server (and before hydration) nothing is shown.
  return useSyncExternalStore(subscribe, mode, () => 'installed');
}

/** Opens Chrome's install prompt. */
export async function promptInstall() {
  const e = deferred;
  if (!e) return;
  await e.prompt();
  const { outcome } = await e.userChoice;
  deferred = null; // a prompt can be used once
  if (outcome === 'accepted') installed = true;
  notify();
}
