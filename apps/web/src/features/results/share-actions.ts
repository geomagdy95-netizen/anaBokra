export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

interface ShareDeps {
  fetchImpl?: typeof fetch;
  nav?: Pick<Navigator, 'canShare' | 'share'> | { canShare?: undefined; share?: undefined };
  download?: (blob: Blob, filename: string) => void;
}

function defaultDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Web Share API with files when the browser supports it, otherwise a plain download. */
export async function shareOrDownload(url: string, filename: string, text: string, deps: ShareDeps = {}): Promise<ShareOutcome> {
  const res = await (deps.fetchImpl ?? fetch)(url);
  if (!res.ok) throw new Error('image_failed');
  const blob = await res.blob();
  const nav = deps.nav ?? (typeof navigator !== 'undefined' ? navigator : {});
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // any other share failure: fall through to the download
    }
  }
  (deps.download ?? defaultDownload)(blob, filename);
  return 'downloaded';
}
