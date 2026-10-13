import { handleResearch } from '@/server/research/http';

export const runtime = 'nodejs';

/** One anonymous path answer set (consent-texts §2.3): a checked path's answers, no name, no ID, no key. */
export function POST(request: Request) {
  return handleResearch(request, (svc, body, ip) => svc.submitPathSet(body, ip));
}
