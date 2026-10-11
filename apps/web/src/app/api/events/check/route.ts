import { handleResearch } from '@/server/research/http';

export const runtime = 'nodejs';

/** "Joining a session?" (consent-texts §2.2): checks a partner session code. */
export function POST(request: Request) {
  return handleResearch(request, (svc, body, ip) => svc.checkEvent((body as { code?: unknown } | null)?.code, ip));
}
