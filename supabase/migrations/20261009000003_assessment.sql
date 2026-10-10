-- =============================================================================
-- anaBokra MX-04 / 03  ASSESSMENT
--   instrument_versions (+ instrument_keys), assessment_sessions, responses,
--   results, readiness_checks
-- =============================================================================

-- Immutable-once-published instrument definitions (content = the JSON in
-- packages/content/instruments/*.json, minus answer keys).
create table public.instrument_versions (
  id            uuid primary key default gen_random_uuid(),
  instrument_id text not null check (instrument_id ~ '^[a-z][a-z0-9_]*$'),   -- interests | personality | values | abilities | readiness
  version       text not null check (char_length(version) between 1 and 40),
  kind          text not null check (kind in ('likert', 'cardSort', 'abilities', 'readiness')),
  content       jsonb not null check (jsonb_typeof(content) = 'object'),
  content_hash  text,                                                        -- sha256 hex of canonical content, set by the importer
  status        text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  approved_by   uuid references public.profiles (id) on delete set null,     -- psychologist / assessment_lead sign-off
  approved_at   timestamptz,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (instrument_id, version),
  check (status <> 'active' or (approved_at is not null and published_at is not null))
);
-- at most one active version per instrument
create unique index instrument_versions_one_active on public.instrument_versions (instrument_id) where status = 'active';

-- Answer keys for ability performance items live apart so students can read the
-- instrument without being able to read the answers.
create table public.instrument_keys (
  instrument_version_id uuid primary key references public.instrument_versions (id) on delete cascade,
  scoring_key           jsonb not null check (jsonb_typeof(scoring_key) = 'object'),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create function public.instrument_versions_freeze() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'draft' and (new.content is distinct from old.content
                                or new.instrument_id <> old.instrument_id
                                or new.version <> old.version
                                or new.kind <> old.kind) then
    raise exception 'instrument content is frozen once active; publish a new version' using errcode = '42501';
  end if;
  if old.status = 'retired' and new.status <> 'retired' then
    raise exception 'retired instrument versions cannot be reactivated' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger instrument_versions_freeze
  before update on public.instrument_versions
  for each row execute function public.instrument_versions_freeze();

-- ---------------------------------------------------------------------------
-- assessment_sessions  (save / resume)
-- ---------------------------------------------------------------------------
create table public.assessment_sessions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles (id) on delete cascade,
  kind                  text not null default 'full' check (kind in ('full', 'quick')),
  status                text not null default 'in_progress'
                        check (status in ('in_progress', 'paused', 'completed', 'abandoned')),
  station               text,                                        -- current station: interests | personality | values | abilities | ...
  stations_done         text[] not null default '{}',
  progress              jsonb not null default '{}'::jsonb check (jsonb_typeof(progress) = 'object'),  -- UI resume state (item cursor, card-sort buckets)
  instrument_version_ids uuid[] not null default '{}',               -- pinned versions used by this session
  locale                text not null default 'ar' check (locale in ('ar', 'en')),
  client                jsonb not null default '{}'::jsonb,           -- app version / device class
  started_at            timestamptz not null default now(),
  last_active_at        timestamptz not null default now(),
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check ((status = 'completed') = (completed_at is not null))
);
create index assessment_sessions_user_idx on public.assessment_sessions (user_id, started_at desc);
-- one open FULL session per student (resume instead of restarting)
create unique index assessment_sessions_one_open_full
  on public.assessment_sessions (user_id) where kind = 'full' and status in ('in_progress', 'paused');

-- Consent gate, enforced for EVERY caller (RLS also checks it for end users):
-- creating a full session, or (re)activating one, requires can_start_full_assessment().
create function public.assessment_sessions_consent_gate() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind = 'full'
     and (tg_op = 'INSERT' or (new.status = 'in_progress' and old.status <> 'in_progress'))
     and not public.can_start_full_assessment(new.user_id) then
    raise exception 'consent_required: a guardian must consent before a minor starts the full assessment'
      using errcode = '42501', hint = 'see consents / create_consent_invite()';
  end if;
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.kind <> old.kind) then
    raise exception 'session owner/kind are immutable' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger assessment_sessions_consent_gate
  before insert or update on public.assessment_sessions
  for each row execute function public.assessment_sessions_consent_gate();

-- Withdrawing the last active consent pauses the student's open full session.
create function public.consents_pause_sessions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.withdrawn_at is not null and old.withdrawn_at is null
     and not public.has_active_consent(new.student_id, 'assessment')
     and public.is_minor(new.student_id) then
    update public.assessment_sessions
       set status = 'paused'
     where user_id = new.student_id and kind = 'full' and status = 'in_progress';
  end if;
  return new;
end $$;

create trigger consents_pause_sessions
  after update of withdrawn_at on public.consents
  for each row execute function public.consents_pause_sessions();

-- May the CURRENT user write answers into this session right now?
-- (owner, session open, and - for full sessions - still allowed to take them.)
create function public.can_answer_session(p_session uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assessment_sessions s
     where s.id = p_session
       and s.user_id = auth.uid()
       and s.status = 'in_progress'
       and (s.kind <> 'full' or public.can_start_full_assessment(s.user_id))
  )
$$;

-- ---------------------------------------------------------------------------
-- responses  (raw answers; NEVER exposed to parents / schools)
-- ---------------------------------------------------------------------------
create table public.responses (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.assessment_sessions (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,   -- denormalised for RLS / erasure
  instrument_id text not null,
  item_id       text not null check (char_length(item_id) between 1 and 80),
  value         numeric(8, 3) not null,           -- likert 1..5, card bucket weight, ability option index...
  ms            integer check (ms is null or ms between 0 and 3600000),   -- time on item (quality checks)
  answered_at   timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (session_id, item_id)
);
create index responses_user_idx on public.responses (user_id);

-- ---------------------------------------------------------------------------
-- results  (written by the scoring backend; one per completed session)
-- ---------------------------------------------------------------------------
create table public.results (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  session_id         uuid not null unique references public.assessment_sessions (id) on delete cascade,
  assessment_version text not null,                    -- instrument-set tag, e.g. '2026.1'
  engine_version     text,                             -- @anabokra/engine version
  norms_version      text,                             -- NULL / 'raw' until Egyptian norms exist
  -- {interests:{R..C}, personality:{...}, values:{...}, abilities:{...}} each 0..1
  scores             jsonb not null check (jsonb_typeof(scores) = 'object'),
  -- CareerMatch[] (careerId, cluster, fit, components, coverage, reasons, watchOuts, flags)
  matches            jsonb not null default '[]'::jsonb check (jsonb_typeof(matches) = 'array'),
  context            jsonb not null default '{}'::jsonb,   -- UserContext used for matching
  coverage           numeric(4, 3) check (coverage between 0 and 1),
  quality            jsonb not null default '{}'::jsonb check (jsonb_typeof(quality) = 'object'),  -- straightlining / rushing / attention flags
  -- Parent-safe digest (holland code, top clusters, top careers). The ONLY part
  -- of a result that parents / schools see (via student_summary).
  summary            jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_at         timestamptz not null default now()
);
create index results_user_idx on public.results (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- readiness_checks  (decision-readiness pre / post)
-- ---------------------------------------------------------------------------
create table public.readiness_checks (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles (id) on delete cascade,
  session_id            uuid references public.assessment_sessions (id) on delete set null,
  instrument_version_id uuid references public.instrument_versions (id) on delete set null,
  phase                 text not null check (phase in ('pre', 'post')),
  answers               jsonb not null check (jsonb_typeof(answers) = 'object'),   -- {item_id: value}
  score                 numeric(5, 2) check (score between 0 and 100),
  taken_at              timestamptz not null default now(),
  created_at            timestamptz not null default now()
);
create index readiness_checks_user_idx on public.readiness_checks (user_id, taken_at desc);
create unique index readiness_checks_session_phase on public.readiness_checks (session_id, phase) where session_id is not null;
