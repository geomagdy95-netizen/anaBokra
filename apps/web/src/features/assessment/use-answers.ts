'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { assessmentApi, type ResponseItem } from './api';
import { SaveQueue, SaveFailure, type SaveStatus } from './save-queue';
import type { AnswerMap } from './types';

const storageKey = (sessionId: string, station: string) => `anabokra:assessment:unsent:${sessionId}:${station}`;

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Answers of one station + their debounced, batched, retried persistence.
 * `initial` is what the server already has; unsent answers left in this browser by an earlier
 * visit (offline reload) are merged on mount and sent again.
 */
export function useAnswers({ sessionId, station, initial }: { sessionId: string; station: string; initial: AnswerMap }) {
  const [answers, setAnswers] = useState<AnswerMap>(initial);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [fatal, setFatal] = useState<string | null>(null);
  const queue = useRef<SaveQueue<ResponseItem> | null>(null);
  const cursor = useRef<Record<string, unknown> | undefined>(undefined);

  useEffect(() => {
    const q = new SaveQueue<ResponseItem>({
      keyOf: (i) => i.itemId,
      send: async (items) => {
        await assessmentApi.saveResponses(sessionId, station, items, cursor.current);
      },
      storage: safeStorage(),
      storageKey: storageKey(sessionId, station),
      isOnline: () => navigator.onLine,
      onStatus: setStatus,
      onFatal: (e: SaveFailure) => setFatal(e.code ?? 'server_error'),
    });
    queue.current = q;
    const restored = q.pendingItems();
    if (restored.length) setAnswers((a) => ({ ...a, ...Object.fromEntries(restored.map((r) => [r.itemId, r.value])) }));

    const online = () => q.notifyOnline();
    const hidden = () => {
      if (document.visibilityState === 'hidden') void q.flush().catch(() => {});
    };
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', hidden);
      q.dispose();
      queue.current = null;
    };
  }, [sessionId, station]);

  const setAnswer = useCallback((itemId: string, value: number, ms?: number, resume?: Record<string, unknown>) => {
    cursor.current = resume;
    setAnswers((a) => (a[itemId] === value ? a : { ...a, [itemId]: value }));
    queue.current?.add({ itemId, value, ...(ms !== undefined ? { ms: Math.min(Math.round(ms), 3_600_000) } : {}) });
  }, []);

  const flush = useCallback(() => queue.current?.flush() ?? Promise.resolve(), []);

  return { answers, setAnswer, flush, status, fatal };
}
