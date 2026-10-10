'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';

import { CONSENT_CHECKS, FAMILY_CHECK, POLICY_VERSION, REQUIRED_CHECKS } from '@/server/consent/constants';

/**
 * The guardian checkboxes (DRAFT texts, docs/legal/consent-texts.*.md section 2 step 3).
 * All unticked by default; the optional one never blocks anything.
 */
export function ConsentChecks({
  teen,
  value,
  onChange,
  family = false,
}: {
  teen: string;
  value: string[];
  onChange: (next: string[]) => void;
  family?: boolean;
}) {
  const t = useTranslations('Consent');
  const base = useId();
  const ids: string[] = [...CONSENT_CHECKS, ...(family ? [FAMILY_CHECK] : [])];
  const toggle = (id: string, on: boolean) => onChange(on ? [...new Set([...value, id])] : value.filter((v) => v !== id));
  return (
    <fieldset className="flex flex-col gap-3">
      {ids.map((id) => {
        const required = id === FAMILY_CHECK || (REQUIRED_CHECKS as readonly string[]).includes(id);
        const key = id === 'guardian' && family ? 'guardianFamily' : id;
        return (
          <label key={id} htmlFor={`${base}-${id}`} className="flex items-start gap-3 text-sm leading-relaxed">
            <input
              id={`${base}-${id}`}
              type="checkbox"
              className="mt-1 size-5 shrink-0 accent-primary"
              checked={value.includes(id)}
              onChange={(e) => toggle(id, e.target.checked)}
              required={required}
              data-testid={`check-${id}`}
            />
            <span>
              {t(`checks.${key}`, { teen, version: POLICY_VERSION })}{' '}
              <span className="text-xs text-muted-foreground">({required ? t('parent.required') : t('parent.optional')})</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
