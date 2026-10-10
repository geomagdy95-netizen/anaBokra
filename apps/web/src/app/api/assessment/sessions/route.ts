import { handleAssessment } from '@/server/assessment/http';

export const runtime = 'nodejs';

/** Start a session, or resume the open one. Body: { kind?: 'full'|'quick', locale?: 'ar'|'en' }. */
export async function POST(request: Request) {
  return handleAssessment(request, { method: 'POST', run: ({ service, userId, body }) => service.startSession(userId, body) });
}
