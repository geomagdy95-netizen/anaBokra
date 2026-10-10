import { handlePublic, localeOf } from '@/server/consent/http';

export const runtime = 'nodejs';

/** "I do not agree": final for this invite. No assessment data is collected. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return handlePublic(request, { run: async ({ service, body }) => ({ invite: await service.decline(token, localeOf(body.locale)) }) });
}
