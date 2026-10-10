'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { assessmentApi } from '@/features/assessment/api';

import { loadTeaserAnswers, TEASER_STORAGE_KEY } from './teaser';

/**
 * After signup, carries the teaser answers (A3) into the student's first interests station so
 * they don't answer the same 12 cards twice. Only runs while that station is still untouched.
 */
export function TeaserClaim({
  sessionId,
  interestsAnswered,
  onDone,
}: {
  sessionId: string;
  interestsAnswered: number;
  /** Re-load after the answers are carried over (defaults to a server refresh). */
  onDone?: () => void;
}) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || interestsAnswered > 0) return;
    done.current = true;
    const answers = typeof window === 'undefined' ? null : loadTeaserAnswers(window.localStorage);
    if (!answers) return;
    const responses = Object.entries(answers).map(([itemId, value]) => ({ itemId, value }));
    void assessmentApi.saveResponses(sessionId, 'interests', responses).then(
      () => {
        try {
          localStorage.removeItem(TEASER_STORAGE_KEY);
        } catch {
          // ignore
        }
        if (onDone) onDone();
        else router.refresh();
      },
      () => undefined, // keep the answers for the next visit
    );
  }, [sessionId, interestsAnswered, router, onDone]);

  return null;
}
