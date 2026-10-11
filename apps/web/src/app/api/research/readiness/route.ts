import { handleResearch } from '@/server/research/http';

export const runtime = 'nodejs';

/** One readiness record with the phone's random link code (consent-texts §2.3). */
export function POST(request: Request) {
  return handleResearch(request, (svc, body, ip) => svc.submitReadiness(body, ip));
}
