import type { ReactNode } from 'react';

import { LocaleSwitcher } from '@/components/locale-switcher';

/** Shared page frame of the consent screens: narrow column, title, language switch. */
export function ConsentShell({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <main className={`mx-auto flex min-h-dvh w-full flex-col gap-6 px-4 py-8 ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
      <header className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <LocaleSwitcher />
      </header>
      {children}
    </main>
  );
}

export const cardClass = 'flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground';
