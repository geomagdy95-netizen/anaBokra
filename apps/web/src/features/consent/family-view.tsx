'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { errorClass, hintClass, inputClass, labelClass } from '@/features/auth/field-styles';
import { Link, useRouter } from '@/i18n/navigation';
import { RELATIONS, REQUIRED_CHECKS } from '@/server/consent/constants';
import type { ChildRecord } from '@/server/consent/types';

import { errorText, postJson } from './api';
import { ConsentChecks } from './checks';
import { cardClass } from './shell';

/** J3 (route B): the signed-in parent adds a child; the consent is recorded at creation. Lists the children with their permission status. */
export function FamilyView({ members, defaultGuardianName }: { members: ChildRecord[]; defaultGuardianName: string }) {
  const t = useTranslations('Consent');
  const locale = useLocale();
  const router = useRouter();
  const format = useFormatter();
  const [form, setForm] = useState({ name: '', dob: '', school: '', teenPhone: '', guardianName: defaultGuardianName, relation: 'mother' });
  const [checks, setChecks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const ready = REQUIRED_CHECKS.every((c) => checks.includes(c)) && checks.includes('family') && form.name.trim().length >= 2 && form.dob && form.teenPhone.trim().length >= 8 && form.guardianName.trim().length >= 2;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postJson<{ studentId: string }>('/api/consent/family/children', { ...form, checks, locale });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setAdded(form.name);
    setForm((f) => ({ ...f, name: '', dob: '', school: '', teenPhone: '' }));
    setChecks([]);
    router.refresh();
  }

  const field = (id: string, label: string, props: React.ComponentProps<'input'> = {}) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input id={id} className={inputClass} {...props} />
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      <p>{t('family.intro')}</p>

      <section className="flex flex-col gap-3" aria-label={t('family.title')}>
        {members.length === 0 && <p className={hintClass}>{t('family.empty')}</p>}
        {members.map((c) => (
          <article key={c.studentId} className={cardClass} data-testid="child-card">
            <h2 className="font-semibold">{c.name}</h2>
            <p className="text-sm" data-testid="child-permission">
              {t('family.permission')}:{' '}
              {c.consent ? t('family.permissionActive', { date: format.dateTime(new Date(c.consent.grantedAt), { dateStyle: 'medium' }) }) : t('family.permissionNone')}
            </p>
            {c.consent && <p className={hintClass}>{t('family.viaRoute', { route: t(`routes.${c.consent.route}`) })}</p>}
            <p className={hintClass}>{c.claimed ? t('family.claimed', { name: c.name }) : t('family.claimNote', { name: c.name })}</p>
          </article>
        ))}
        <Button asChild variant="outline">
          <Link href="/family/settings">{t('family.settings')}</Link>
        </Button>
      </section>

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <h2 className="text-lg font-semibold">{t('family.add')}</h2>
        <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">{t('draftNotice')}</p>
        {field('child-name', t('family.nameLabel'), { value: form.name, onChange: set('name'), maxLength: 100 })}
        {field('child-dob', `${t('family.dobLabel')} (${t('family.ageHint')})`, { type: 'date', value: form.dob, onChange: set('dob'), dir: 'ltr' })}
        {field('child-school', t('family.schoolLabel'), { value: form.school, onChange: set('school'), maxLength: 200 })}
        <div className="flex flex-col gap-1.5">
          {field('child-phone', t('family.teenPhoneLabel'), { type: 'tel', inputMode: 'tel', dir: 'ltr', value: form.teenPhone, onChange: set('teenPhone') })}
          <p className={hintClass}>{t('family.teenPhoneHint')}</p>
        </div>
        {field('guardian-name', t('family.guardianNameLabel'), { value: form.guardianName, onChange: set('guardianName'), maxLength: 100, autoComplete: 'name' })}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="guardian-relation" className={labelClass}>
            {t('family.relationLabel')}
          </label>
          <select id="guardian-relation" className={inputClass} value={form.relation} onChange={set('relation')}>
            {RELATIONS.map((r) => (
              <option key={r} value={r}>
                {t(`relations.${r}`)}
              </option>
            ))}
          </select>
        </div>
        <ConsentChecks teen={form.name.trim().split(/\s+/)[0] || t('notice.fallbackTeen')} value={checks} onChange={setChecks} family />
        {error && (
          <p role="alert" className={errorClass}>
            {errorText(t, error)}
          </p>
        )}
        {added && (
          <p role="status" className="text-sm" data-testid="child-added">
            {t('family.added', { name: added })}
          </p>
        )}
        <Button type="submit" size="lg" disabled={busy || !ready}>
          {busy ? t('family.submitting') : t('family.submit')}
        </Button>
      </form>
    </div>
  );
}
