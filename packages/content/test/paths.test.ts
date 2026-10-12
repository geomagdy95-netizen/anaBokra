import { describe, expect, it } from 'vitest';
import type { I18n } from '@anabokra/engine';
import { careers, paths } from '../src';

const bilingual = (t: I18n | undefined, where: string) => {
  expect(t?.en?.trim(), `${where} en`).toBeTruthy();
  expect(t?.ar?.trim(), `${where} ar`).toBeTruthy();
  expect(t!.ar, `${where} ar uses Latin digits`).not.toMatch(/[٠-٩]/);
};

describe('path (Verify) content', () => {
  it('has the four pilot paths', () => {
    expect(Object.keys(paths).sort()).toEqual(['business', 'engineering', 'health', 'tech']);
  });

  for (const path of Object.values(paths)) {
    describe(path.id, () => {
      const inGroup = new Set(careers.filter((c) => c.cluster === path.id).map((c) => c.id));
      const items: { id: string; careers?: string[] }[] = path.tasks.flatMap((t): { id: string; careers?: string[] }[] => t.items);

      it('has a day, a real-deal and a try-it task, each of 4–10 items', () => {
        expect(path.tasks.map((t) => t.kind)).toEqual(['story', 'thisOrThat', 'tryIt']);
        for (const t of path.tasks) {
          expect(t.items.length).toBeGreaterThanOrEqual(4);
          expect(t.items.length).toBeLessThanOrEqual(10);
          bilingual(t.title, `${path.id}.${t.id}.title`);
          bilingual(t.intro, `${path.id}.${t.id}.intro`);
        }
      });

      it('uses unique ids prefixed with the path, and careers from this group only', () => {
        const ids = items.map((i) => i.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const i of items) {
          expect(i.id.startsWith(`${path.id}_`)).toBe(true);
          for (const c of i.careers ?? []) expect(inGroup, `${i.id}: ${c}`).toContain(c);
        }
      });

      it('has text in both languages and well-formed answers', () => {
        for (const t of path.tasks) {
          for (const i of t.items as unknown as { id: string; [k: string]: unknown }[]) {
            if (t.kind === 'story') bilingual(i.text as I18n, i.id);
            if (t.kind === 'thisOrThat') {
              const c = i as unknown as { a: I18n; b: I18n; path: string };
              bilingual(c.a, `${i.id}.a`);
              bilingual(c.b, `${i.id}.b`);
              expect(['a', 'b']).toContain(c.path);
            }
            if (t.kind === 'tryIt') {
              const x = i as unknown as { type: string; text: I18n; options: unknown[]; answer?: number; explain?: I18n };
              bilingual(x.text, i.id);
              expect(x.options.length).toBeGreaterThanOrEqual(3);
              if (x.type === 'puzzle') {
                expect(x.answer).toBeGreaterThanOrEqual(0);
                expect(x.answer).toBeLessThan(x.options.length);
                bilingual(x.explain, `${i.id}.explain`);
                for (const o of x.options as I18n[]) bilingual(o, `${i.id}.option`);
              } else {
                for (const o of x.options as { text: I18n; fit: number }[]) {
                  bilingual(o.text, `${i.id}.option`);
                  expect(o.fit).toBeGreaterThanOrEqual(0);
                  expect(o.fit).toBeLessThanOrEqual(1);
                }
                expect(Math.max(...(x.options as { fit: number }[]).map((o) => o.fit))).toBe(1);
              }
            }
          }
        }
      });

      it('touches every career in the group at least once', () => {
        const touched = new Set(items.flatMap((i) => i.careers ?? [...inGroup]));
        for (const c of inGroup) expect(touched, c).toContain(c);
      });
    });
  }
});
