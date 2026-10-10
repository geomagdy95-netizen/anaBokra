import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ImageResponse } from 'next/og';

import { DEFAULT_PALETTE } from '@/features/path/palette';
import { generateWorld } from '@/features/path/generate-world';
import { buildShareModel, isShareFormat, parsePrivacy, SHARE_FORMATS } from '@/features/results/share';
import { buildProfileView, splitMatches, toMatchView } from '@/features/results/view';
import { WorldMapSvg } from '@/features/results/world-svg';
import { getAssessmentRuntime } from '@/server/assessment/runtime';
import messagesAr from '../../../../../../messages/ar.json';
import messagesEn from '../../../../../../messages/en.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Arabic needs a font with Arabic glyphs; IBM Plex Sans Arabic also covers Latin. Read once, lazily.
let fonts: Promise<[Buffer, Buffer]> | undefined;
const loadFonts = () =>
  (fonts ??= Promise.all(
    ['Regular', 'Bold'].map((w) => readFile(path.join(process.cwd(), 'src/assets/fonts', `IBMPlexSansArabic-${w}.ttf`))),
  ) as Promise<[Buffer, Buffer]>);

const toArrayBuffer = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

const INK = '#1f2a37';
const TEAL = '#0f766e';

/**
 * Share card (E6). GET /api/assessment/share/story|post?locale=ar|en&hideName=1&hideMatches=1
 * Privacy flags are applied while building the model, so hidden data never reaches the image.
 */
export async function GET(request: Request, ctx: { params: Promise<{ format: string }> }) {
  const { format } = await ctx.params;
  if (!isShareFormat(format)) return new Response('Not found', { status: 404 });

  const rt = await getAssessmentRuntime();
  if (!rt) return new Response('Unauthorized', { status: 401 });
  const latest = await rt.service.getLatestResult(rt.userId);
  if (!latest) return new Response('No result yet', { status: 404 });

  const url = new URL(request.url);
  const lang = url.searchParams.get('locale') === 'en' ? 'en' : 'ar';
  const privacy = parsePrivacy(url.searchParams);
  const profile = await rt.profile();

  const pv = buildProfileView(latest.scores);
  const top = splitMatches(latest.matches).top.map((m) => toMatchView(m, lang));
  const model = buildShareModel({ hollandCode: pv.hollandCode, top }, profile.displayName, privacy);

  const interests = (latest.scores.interests ?? {}) as Record<'R' | 'I' | 'A' | 'S' | 'E' | 'C', number>;
  const world = generateWorld({ interests });
  const { width, height } = SHARE_FORMATS[format];
  const card = (lang === 'ar' ? messagesAr : messagesEn).Results.share.card;
  const rtl = lang === 'ar';
  const dir = rtl ? 'rtl' : 'ltr';
  const mapSize = format === 'story' ? 920 : 440;
  // satori does not reorder mixed Arabic/Latin runs inside one text node, so each script run is its own flex child
  // (in an rtl row the first child sits on the right).
  const titleParts = model.name ? card.by.split('{name}').flatMap((p, i, a) => [p.trim(), ...(i < a.length - 1 ? [model.name!] : [])]).filter(Boolean) : [card.kicker];
  const brandParts = card.brand.match(/^([^A-Za-z]+)([A-Za-z]+)$/)?.slice(1) ?? [card.brand];

  const image = (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: format === 'story' ? '120px 80px' : '48px 70px',
        background: 'linear-gradient(180deg, #fdf6ec 0%, #f2e4d4 100%)',
        color: INK,
        fontFamily: 'Plex',
        direction: rtl ? 'rtl' : 'ltr',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', direction: dir, fontSize: 40, fontWeight: 700, color: TEAL }}>
          {(rtl ? [...brandParts].reverse() : brandParts).map((part, i) => (
            <div key={i} style={{ display: 'flex' }}>
              {part}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', direction: dir, gap: 20, fontSize: format === 'story' ? 84 : 64, fontWeight: 700 }}>
          {(rtl ? [...titleParts].reverse() : titleParts).map((part, i) => (
            <div key={i} style={{ display: 'flex' }}>
              {part}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', borderRadius: 48, overflow: 'hidden', border: '8px solid #ffffff' }}>
        <WorldMapSvg world={world} palette={DEFAULT_PALETTE} size={mapSize} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', direction: dir, fontSize: 32, color: '#52606d' }}>{card.code}</div>
        <div style={{ display: 'flex', fontSize: format === 'story' ? 130 : 84, fontWeight: 700, letterSpacing: 16, color: TEAL, direction: 'ltr' }}>
          {model.hollandCode}
        </div>
        {model.topArea ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 14 }}>
            <div style={{ display: 'flex', direction: dir, fontSize: 30, color: '#52606d' }}>{card.area}</div>
            <div style={{ display: 'flex', direction: dir, fontSize: format === 'story' ? 56 : 40, fontWeight: 700, textAlign: 'center' }}>{model.topArea}</div>
          </div>
        ) : null}
      </div>
    </div>
  );

  try {
    const [regular, bold] = await loadFonts();
    return new ImageResponse(image, {
      width,
      height,
      fonts: [
        { name: 'Plex', data: toArrayBuffer(regular), weight: 400, style: 'normal' },
        { name: 'Plex', data: toArrayBuffer(bold), weight: 700, style: 'normal' },
      ],
      headers: { 'cache-control': 'private, no-store' },
    });
  } catch {
    return new Response('Could not render image', { status: 500 });
  }
}
