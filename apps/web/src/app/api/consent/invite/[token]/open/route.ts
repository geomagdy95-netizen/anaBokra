import { handlePublic, localeOf } from '@/server/consent/http';

export const runtime = 'nodejs';

/** Called by the landing page from the browser (not on server render, so link previews do not mark it opened). */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return handlePublic(request, { run: async ({ service, body }) => ({ invite: await service.openInvite(token, localeOf(body.locale)) }) });
}
