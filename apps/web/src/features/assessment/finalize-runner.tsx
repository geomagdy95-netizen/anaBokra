'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';

import { assessmentApi } from './api';
import { useAT } from './ui-context';

/** Scores the session on the server (idempotent), then shows the stored result. */
export function FinalizeRunner({ sessionId }: { sessionId: string }) {
  const at = useAT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const run = async () => {
    setError(null);
    try {
      await assessmentApi.finalize(sessionId);
      router.replace(`/assessment/result?s=${sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'server_error');
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return error ? (
    <div className="flex flex-col items-start gap-3" data-testid="finalize-error">
      <p role="alert" className="text-destructive">
        {error === 'network' ? at('finishing.offline') : at('result.failed')}
      </p>
      <Button onClick={() => void run()}>{at('finishing.retry')}</Button>
    </div>
  ) : (
    <p role="status" data-testid="finalizing">
      {at('result.working')}
    </p>
  );
}
