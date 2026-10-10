import { RIASEC } from '@anabokra/engine';
import { describe, expect, it } from 'vitest';

import { markdownToHtml } from './markdown';
import { loadTeaserAnswers, scoreTeaser, TEASER_ITEMS, TEASER_STORAGE_KEY } from './teaser';

describe('teaser', () => {
  it('has 12 interest items, two per RIASEC type, interleaved', () => {
    expect(TEASER_ITEMS).toHaveLength(12);
    for (const k of RIASEC) expect(TEASER_ITEMS.filter((i) => i.scale === k)).toHaveLength(2);
    expect(TEASER_ITEMS.slice(0, 6).map((i) => i.scale)).toEqual([...RIASEC]);
  });

  it('scores 0..1 per type and returns the top two', () => {
    const answers = Object.fromEntries(TEASER_ITEMS.map((i) => [i.id, i.scale === 'A' ? 5 : i.scale === 'S' ? 4 : 1]));
    const r = scoreTeaser(answers);
    expect(r.scores.A).toBe(1);
    expect(r.scores.S).toBe(0.75);
    expect(r.scores.R).toBe(0);
    expect(r.top).toEqual(['A', 'S']);
  });

  it('treats unanswered types as neutral and breaks ties in RIASEC order', () => {
    expect(scoreTeaser({}).top).toEqual(['R', 'I']);
    expect(scoreTeaser({}).scores.C).toBe(0.5);
  });

  it('loads only valid saved answers', () => {
    const id = TEASER_ITEMS[0]!.id;
    const store = (v: string | null) => ({ getItem: (k: string) => (k === TEASER_STORAGE_KEY ? v : null) });
    expect(loadTeaserAnswers(store(JSON.stringify({ [id]: 4, bogus: 5, [TEASER_ITEMS[1]!.id]: 9 })))).toEqual({ [id]: 4 });
    expect(loadTeaserAnswers(store('not json'))).toBeNull();
    expect(loadTeaserAnswers(store(null))).toBeNull();
    expect(loadTeaserAnswers(undefined)).toBeNull();
  });
});

describe('markdownToHtml', () => {
  it('renders headings (shifted one level), lists, tables and inline formatting', () => {
    const html = markdownToHtml('# Title\n\nSome **bold** and *it* `code`.\n\n- a\n- b\n\n1. one\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n> note');
    expect(html).toContain('<h2>Title</h2>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>it</em>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<ul><li>a</li><li>b</li></ul>');
    expect(html).toContain('<ol><li>one</li></ol>');
    expect(html).toContain('<thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody>');
    expect(html).toContain('<blockquote><p>note</p></blockquote>');
  });

  it('escapes HTML and drops unsafe links', () => {
    const html = markdownToHtml('<script>alert(1)</script> [x](javascript:alert(1)) [ok](https://example.com) [mail](mailto:a@b.c)');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('<a href="https://example.com" rel="noopener noreferrer">ok</a>');
    expect(html).toContain('href="mailto:a@b.c"');
  });

  it('skips the RTL wrapper divs used in the Arabic drafts', () => {
    expect(markdownToHtml('<div dir="rtl" lang="ar">\n\nنص\n\n</div>')).toBe('<p>نص</p>');
  });
});
