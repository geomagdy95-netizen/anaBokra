import { handleAssessment } from '@/server/assessment/http';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return handleAssessment(request, {
    method: 'GET',
    run: async ({ service, userId }) => ({ result: await service.getResult(userId, { sessionId }) }),
  });
}
