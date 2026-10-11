import { handleResearch } from '@/server/research/http';

export const runtime = 'nodejs';

/** Deletes the readiness records sent from this phone (identified only by its link code). */
export function POST(request: Request) {
  return handleResearch(request, async (svc, body, ip) => ({ deleted: await svc.forget(body, ip) }));
}
