import type { Bilingual } from '@anabokra/content';
import type { ReactNode } from 'react';

import type { Locale } from './types';

export const pick = (b: Bilingual | undefined | null, locale: Locale): string => (b ? b[locale] : '');

export function BulletList({ items, locale, className }: { items: Bilingual[] | undefined; locale: Locale; className?: string }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className={className ?? 'list-disc space-y-1 ps-5'}>
      {items.map((it, i) => (
        <li key={i}>{it[locale]}</li>
      ))}
    </ul>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-32 space-y-4">
      <h2 id={`${id}-title`} className="text-xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-base font-semibold text-muted-foreground">{children}</h3>;
}
