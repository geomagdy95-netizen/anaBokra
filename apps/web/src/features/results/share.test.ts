import { describe, expect, it, vi } from 'vitest';

import { buildShareModel, DEFAULT_PRIVACY, parsePrivacy, privacyQuery } from './share';
import { shareOrDownload } from './share-actions';

const view = { hollandCode: 'IAS', top: [{ cluster: 'Health', name: 'Doctor' }] } as never;

describe('share privacy', () => {
  it('shows the first name and top area by default', () => {
    expect(buildShareModel(view, 'Sara Ali', DEFAULT_PRIVACY)).toEqual({ name: 'Sara', hollandCode: 'IAS', topArea: 'Health' });
  });
  it('hideName removes the name, hideMatches removes the top area', () => {
    expect(buildShareModel(view, 'Sara Ali', { hideName: true, hideMatches: false }).name).toBeNull();
    const m = buildShareModel(view, 'Sara Ali', { hideName: false, hideMatches: true });
    expect(m.topArea).toBeNull();
    expect(m.name).toBe('Sara');
    expect(JSON.stringify(m)).not.toContain('Health');
  });
  it('round-trips through the query string', () => {
    const q = privacyQuery({ hideName: true, hideMatches: true }, 'ar');
    expect(parsePrivacy(new URLSearchParams(q))).toEqual({ hideName: true, hideMatches: true });
    expect(parsePrivacy(new URLSearchParams(privacyQuery(DEFAULT_PRIVACY, 'en')))).toEqual(DEFAULT_PRIVACY);
  });
});

describe('shareOrDownload', () => {
  const fetchImpl = (async () => new Response(new Blob(['x'], { type: 'image/png' }))) as typeof fetch;
  it('uses the Web Share API with files when available', async () => {
    const share = vi.fn(async () => {});
    const download = vi.fn();
    const out = await shareOrDownload('/x', 'a.png', 'hi', { fetchImpl, nav: { canShare: () => true, share }, download });
    expect(out).toBe('shared');
    expect(share).toHaveBeenCalledOnce();
    expect(download).not.toHaveBeenCalled();
  });
  it('downloads when sharing is unsupported', async () => {
    const download = vi.fn();
    expect(await shareOrDownload('/x', 'a.png', 'hi', { fetchImpl, nav: {}, download })).toBe('downloaded');
    expect(download).toHaveBeenCalledOnce();
  });
  it('treats a dismissed share sheet as cancelled, not as an error', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('x', 'AbortError');
    });
    const download = vi.fn();
    expect(await shareOrDownload('/x', 'a.png', 'hi', { fetchImpl, nav: { canShare: () => true, share }, download })).toBe('cancelled');
    expect(download).not.toHaveBeenCalled();
  });
});
