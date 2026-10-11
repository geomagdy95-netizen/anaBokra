import { handleResearch } from '@/server/research/http';

export const runtime = 'nodejs';

/** One anonymous answer set (consent-texts §2.3): no name, no ID, no key. */
export function POST(request: Request) {
  return handleResearch(request, (svc, body, ip) => svc.submitAnswerSet(body, ip));
}
