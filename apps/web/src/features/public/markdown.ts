/**
 * Minimal Markdown → HTML for the legal drafts (A8): headings, paragraphs, lists, tables,
 * blockquotes, **bold**, *italic*, `code` and [links](https://…). All text is HTML-escaped first,
 * and only http(s)/mailto links and #anchors survive, so the output is safe to inject.
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(text: string): string {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) =>
      /^(https?:|mailto:|#)/.test(href) ? `<a href="${href}" rel="noopener noreferrer">${label}</a>` : label,
    );
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim() || /^<\/?div[^>]*>$/.test(line.trim())) {
      i++;
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = Math.min(h[1]!.length + 1, 6); // page <h1> is the title
      out.push(`<h${level}>${inline(h[2]!)}</h${level}>`);
      i++;
      continue;
    }
    if (/^\s*\|/.test(line) && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? '')) {
      const head = cells(line);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i]!)) body.push(cells(lines[i++]!));
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`,
      );
      continue;
    }
    const list = /^\s*([-*]|\d+\.)\s+/.exec(line);
    if (list) {
      const ordered = /\d/.test(list[1]!);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]!)) items.push(inline(lines[i++]!.replace(/^\s*([-*]|\d+\.)\s+/, '')));
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((it) => `<li>${it}</li>`).join('')}</${tag}>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!)) quote.push(inline(lines[i++]!.replace(/^>\s?/, '')));
      out.push(`<blockquote><p>${quote.join(' ')}</p></blockquote>`);
      continue;
    }
    if (/^-{3,}$/.test(line.trim())) {
      out.push('<hr>');
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,6}\s|\s*\||\s*([-*]|\d+\.)\s|>|<\/?div)/.test(lines[i]!)) para.push(inline(lines[i++]!.trim()));
    out.push(`<p>${para.join(' ')}</p>`);
  }
  return out.join('\n');
}
