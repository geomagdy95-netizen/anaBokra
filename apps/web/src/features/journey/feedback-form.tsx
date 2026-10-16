'use client';

import { Lock, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { AssessmentProvider } from '@/features/assessment/ui-context';
import type { Locale } from '@/i18n/routing';
import { loadJourney } from '@/lib/journey/journey';
import type { LocalRuntime } from '@/lib/local/runtime';
import { statsSender } from '@/lib/local/stats';
import { cleanFeedbackText, FEEDBACK_PARTS, statsFeedbackSchema, type StatsFeedback } from '@/lib/stats-summary';
import { cn } from '@/lib/utils';

import { useJT } from './use-jt';

type Screen = StatsFeedback['screen'];
type Part = (typeof FEEDBACK_PARTS)[number];
const FACES = ['😞', '🙁', '😐', '🙂', '😍'] as const;

async function send(rt: LocalRuntime, fields: Omit<StatsFeedback, 'v' | 'ageBand' | 'stage' | 'locale' | 'eventCode' | 'kind'>): Promise<boolean> {
  const sender = await statsSender(rt);
  if (!sender) return false;
  const parsed = statsFeedbackSchema.safeParse({ ...sender, kind: 'feedback', ...fields, text: cleanFeedbackText(fields.text) });
  if (!parsed.success) return false;
  try {
    const res = await fetch('/api/stats', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(parsed.data) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * "Tell us what you think": a 1–5 face, what helped, what was confusing and an optional note. Sent
 * anonymously, and only when the user presses Send (consent-texts §1.8); the note is cleaned of
 * e-mails, links and phone numbers first, and again on the server.
 */
export function FeedbackForm({ rt, screen, career = null, onDone }: { rt: LocalRuntime; screen: Screen; career?: string | null; onDone?: () => void }) {
  const jt = useJT();
  const [rating, setRating] = useState<number | null>(null);
  const [liked, setLiked] = useState<Part[]>([]);
  const [confusing, setConfusing] = useState<Part[]>([]);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  if (state === 'sent')
    return (
      <p className="rounded-3xl bg-brand-success/15 p-4 font-semibold text-brand-ink" role="status" data-testid="feedback-thanks">
        💜 {jt('feedback.thanks')}
      </p>
    );

  const toggle = (list: Part[], set: (v: Part[]) => void, p: Part) => set(list.includes(p) ? list.filter((x) => x !== p) : [...list, p]);
  const chip = (on: boolean) =>
    cn('min-h-11 rounded-full border px-4 text-sm font-medium transition-colors', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary');

  return (
    <section className="space-y-4 rounded-3xl border-2 border-brand-lavender bg-card p-4" data-testid="feedback-form">
      <fieldset className="space-y-2">
        <legend className="font-semibold">{jt('feedback.rating')}</legend>
        <div className="flex gap-2" role="radiogroup">
          {FACES.map((face, i) => (
            <button
              key={face}
              type="button"
              role="radio"
              aria-checked={rating === i + 1}
              aria-label={jt(`feedback.faces.${i + 1}`)}
              onClick={() => setRating(i + 1)}
              className={cn('grid size-12 place-items-center rounded-2xl text-2xl transition-transform', rating === i + 1 ? 'scale-110 bg-secondary ring-2 ring-primary' : 'bg-muted/60 hover:bg-secondary')}
              data-testid={`face-${i + 1}`}
            >
              {face}
            </button>
          ))}
        </div>
      </fieldset>
      {(
        [
          ['liked', liked, setLiked],
          ['confusing', confusing, setConfusing],
        ] as const
      ).map(([key, list, set]) => (
        <fieldset key={key} className="space-y-2">
          <legend className="font-semibold">{jt(`feedback.${key}`)}</legend>
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_PARTS.map((p) => (
              <button key={p} type="button" aria-pressed={list.includes(p)} onClick={() => toggle(list, set, p)} className={chip(list.includes(p))} data-testid={`${key}-${p}`}>
                {jt(`feedback.parts.${p}`)}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <label className="block space-y-2">
        <span className="font-semibold">{jt('feedback.note')}</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          rows={3}
          maxLength={500}
          placeholder={jt('feedback.notePlaceholder')}
          className="field h-auto min-h-24 py-3"
          data-testid="feedback-text"
        />
      </label>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {jt('feedback.privacy')}
      </p>
      {state === 'failed' && (
        <p role="alert" className="text-sm text-destructive">
          {jt('feedback.failed')}
        </p>
      )}
      <Button
        disabled={state === 'sending' || (rating === null && !liked.length && !confusing.length && !text.trim())}
        onClick={async () => {
          setState('sending');
          const ok = await send(rt, { screen, career, rating, liked, confusing, text: text.trim() || null });
          setState(ok ? 'sent' : 'failed');
          if (ok) onDone?.();
        }}
        data-testid="feedback-send"
      >
        {jt('feedback.send')}
      </Button>
    </section>
  );
}

/** A quick "was this page useful?" on career pages (phone only), 👍 or 👎, sent when tapped. */
export function PageFeedback({ career }: { career: string }) {
  const locale = useLocale() as Locale;
  const [rt, setRt] = useState<LocalRuntime | null>(null);
  const [gender, setGender] = useState<'female' | 'male' | null>(null);
  useEffect(() => {
    let alive = true;
    void loadJourney(locale)
      .then((s) => {
        if (alive && s.kind === 'ready') {
          setRt(s.rt);
          setGender(s.rt.profile.gender);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [locale]);
  if (!rt) return null;
  return (
    <AssessmentProvider gender={gender}>
      <Thumbs rt={rt} career={career} />
    </AssessmentProvider>
  );
}

function Thumbs({ rt, career }: { rt: LocalRuntime; career: string }) {
  const jt = useJT();
  const [state, setState] = useState<'idle' | 'sent' | 'failed'>('idle');
  const vote = async (up: boolean) => setState((await send(rt, { screen: 'career', career, rating: up ? 5 : 2, liked: [], confusing: [], text: null })) ? 'sent' : 'failed');
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-secondary/60 p-3" data-testid="page-feedback">
      <span className="text-sm font-semibold">{state === 'sent' ? `💜 ${jt('feedback.thanks')}` : jt('feedback.pageQ')}</span>
      {state !== 'sent' && (
        <span className="flex gap-2">
          <Button size="sm" variant="outline" className="bg-card" onClick={() => void vote(true)} aria-label={jt('feedback.yes')} data-testid="page-feedback-up">
            <ThumbsUp className="size-4" aria-hidden />
            {jt('feedback.yes')}
          </Button>
          <Button size="sm" variant="outline" className="bg-card" onClick={() => void vote(false)} aria-label={jt('feedback.no')} data-testid="page-feedback-down">
            <ThumbsDown className="size-4" aria-hidden />
            {jt('feedback.no')}
          </Button>
        </span>
      )}
      {state === 'failed' && <span className="text-xs text-destructive">{jt('feedback.failed')}</span>}
    </div>
  );
}
