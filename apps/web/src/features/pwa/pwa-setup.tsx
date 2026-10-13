'use client';

import { useEffect } from 'react';

import { listenForInstall } from './install';

/**
 * Registers the service worker (src/app/sw.js) in production builds and starts listening for Chrome's
 * install prompt. Rendered once in the locale layout; it draws nothing.
 */
export function PwaSetup() {
  useEffect(() => {
    listenForInstall();
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // No worker (private window, old browser): the app still works online.
    });
  }, []);
  return null;
}

/**
 * Asks the browser not to clear the app's storage when space runs low. Everything the user has lives
 * on this device (docs/system), so it's worth asking once there is a profile. Browsers decide on
 * their own (Chrome and Safari never show a prompt).
 */
export function keepStoredData() {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
  void navigator.storage
    .persisted()
    .then((yes) => (yes ? true : navigator.storage.persist()))
    .catch(() => {});
}
