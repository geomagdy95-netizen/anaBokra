-- =============================================================================
-- anaBokra MX-04 / 04  CONTENT
--   clusters, careers, career_country_data, industries, career_industries,
--   institutions, programs, program_careers, opportunities, opportunity_careers,
--   opportunity_reports, review_queue
-- Career / cluster ids are the TEXT ids from packages/content/careers/catalog.json.
-- Lifecycle: draft -> review -> published -> archived. Only published rows are
-- visible to the public (see RLS).
-- =============================================================================

create table public.clusters (
  id          text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  name        jsonb not null check (public.is_i18n(name)),
  description jsonb check (public.is_i18n_or_null(description)),
  icon        text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.careers (
  id              text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  cluster_id      text not null references public.clusters (id) on update cascade,
  name            jsonb not null check (public.is_i18n(name)),
  summary         jsonb check (public.is_i18n_or_null(summary)),
  description     jsonb check (public.is_i18n_or_null(description)),
  tasks           jsonb check (tasks is null or jsonb_typeof(tasks) = 'array'),   -- [{en, ar}]
  onet_codes      text[] not null default '{}',
  is_proxy        boolean not null default false,          -- no direct O*NET equivalent -> psychologist must review traits
  proxy_note      text,
  holland_code    text check (holland_code ~ '^[RIASEC]{1,3}$'),
  job_zone        smallint check (job_zone between 1 and 5),
  -- CareerTraits (engine types.ts): {riasec, personality, personalityDistinct?, values, abilities}
  traits          jsonb check (traits is null or jsonb_typeof(traits) = 'object'),
  tags            text[] not null default '{}',
  status          public.content_status not null default 'draft',
  content_version integer not null default 1,
  last_reviewed_at timestamptz,
  reviewed_by     uuid references public.profiles (id) on delete set null,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- a published career must be matchable, named in Arabic and reviewed
  check (status <> 'published' or (
        traits ?& array['riasec', 'personality', 'values', 'abilities']
    and length(name ->> 'ar') > 0
    and last_reviewed_at is not null
  ))
);
create index careers_cluster_idx on public.careers (cluster_id);
create index careers_status_idx  on public.careers (status);
create index careers_review_idx  on public.careers (last_reviewed_at) where status = 'published';

-- Egypt-first, other countries later. `path` mirrors CareerEgyptContext
-- (tracks, typicalMinScorePct, costLevel) plus study routes; `market` holds
-- salary band / demand / outlook.
create table public.career_country_data (
  career_id        text not null references public.careers (id) on update cascade on delete cascade,
  country_code     char(2) not null check (country_code ~ '^[A-Z]{2}$'),
  path             jsonb not null default '{}'::jsonb check (jsonb_typeof(path) = 'object'),
  market           jsonb not null default '{}'::jsonb check (jsonb_typeof(market) = 'object'),
  status           public.content_status not null default 'draft',
  last_reviewed_at timestamptz,
  reviewed_by      uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (career_id, country_code),
  check (status <> 'published' or last_reviewed_at is not null)
);

create table public.industries (
  id          text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  name        jsonb not null check (public.is_i18n(name)),
  description jsonb check (public.is_i18n_or_null(description)),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.career_industries (
  career_id   text not null references public.careers (id) on update cascade on delete cascade,
  industry_id text not null references public.industries (id) on update cascade on delete cascade,
  primary key (career_id, industry_id)
);
create index career_industries_industry_idx on public.career_industries (industry_id);

-- ---------------------------------------------------------------------------
-- Institutions / programs
-- ---------------------------------------------------------------------------
create table public.institutions (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name             jsonb not null check (public.is_i18n(name)),
  description      jsonb check (public.is_i18n_or_null(description)),
  type             text not null check (type in (
                     'public_university', 'private_university', 'international_university', 'technical_institute',
                     'vocational_center', 'training_provider', 'employer', 'ngo', 'other')),
  country_code     char(2) not null default 'EG' check (country_code ~ '^[A-Z]{2}$'),
  city             text,
  website          text check (website is null or website ~ '^https?://'),
  logo_url         text,
  status           public.content_status not null default 'draft',
  last_reviewed_at timestamptz,
  reviewed_by      uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (status <> 'published' or last_reviewed_at is not null)
);
create index institutions_status_idx on public.institutions (status, country_code);

create table public.programs (
  id               uuid primary key default gen_random_uuid(),
  institution_id   uuid not null references public.institutions (id) on delete cascade,
  name             jsonb not null check (public.is_i18n(name)),
  description      jsonb check (public.is_i18n_or_null(description)),
  degree_level     text not null check (degree_level in ('certificate', 'diploma', 'bachelor', 'master', 'doctorate', 'other')),
  duration_months  smallint check (duration_months between 1 and 120),
  languages        text[] not null default '{ar}',
  tuition          jsonb not null default '{}'::jsonb check (jsonb_typeof(tuition) = 'object'),    -- {currency, per_year_min, per_year_max, cost_level}
  admission        jsonb not null default '{}'::jsonb check (jsonb_typeof(admission) = 'object'),  -- {tracks:[], min_score_pct, curricula:[], requirements}
  url              text check (url is null or url ~ '^https?://'),
  status           public.content_status not null default 'draft',
  last_reviewed_at timestamptz,
  reviewed_by      uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (status <> 'published' or last_reviewed_at is not null)
);
create index programs_institution_idx on public.programs (institution_id);
create index programs_status_idx on public.programs (status);

create table public.program_careers (
  program_id uuid not null references public.programs (id) on delete cascade,
  career_id  text not null references public.careers (id) on update cascade on delete cascade,
  relevance  smallint not null default 2 check (relevance between 1 and 3),   -- 3 = direct route
  primary key (program_id, career_id)
);
create index program_careers_career_idx on public.program_careers (career_id);

-- ---------------------------------------------------------------------------
-- Opportunities
-- ---------------------------------------------------------------------------
create table public.opportunities (
  id             uuid primary key default gen_random_uuid(),
  type           public.opportunity_type not null,
  title          jsonb not null check (public.is_i18n(title)),
  summary        jsonb check (public.is_i18n_or_null(summary)),
  provider_name  text,
  institution_id uuid references public.institutions (id) on delete set null,
  country_code   char(2) check (country_code is null or country_code ~ '^[A-Z]{2}$'),   -- NULL = global / online
  city           text,
  is_online      boolean not null default false,
  apply_url      text check (apply_url is null or apply_url ~ '^https?://'),
  min_age        smallint check (min_age between 10 and 30),
  max_age        smallint check (max_age between 10 and 99),
  is_free        boolean,
  cost_amount    numeric(12, 2) check (cost_amount >= 0),
  cost_currency  char(3) check (cost_currency ~ '^[A-Z]{3}$'),
  starts_on      date,
  ends_on        date,
  deadline       date,
  -- Sponsored placements must be labelled in the UI.
  is_sponsored   boolean not null default false,
  sponsor_name   text,
  -- Provenance
  source_url     text check (source_url is null or source_url ~ '^https?://'),
  source_type    public.source_type not null default 'curated',
  verified_at    timestamptz,
  verified_by    uuid references public.profiles (id) on delete set null,
  last_checked_at timestamptz,                      -- last link / liveness check
  status         public.content_status not null default 'draft',
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (max_age is null or min_age is null or max_age >= min_age),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  check (not is_sponsored or sponsor_name is not null),
  check ((verified_at is null) = (verified_by is null)),
  -- published => traceable to a source and verified by a human
  check (status <> 'published' or (source_url is not null and verified_at is not null))
);
create index opportunities_public_idx on public.opportunities (type, deadline) where status = 'published';
create index opportunities_status_idx on public.opportunities (status);
create index opportunities_institution_idx on public.opportunities (institution_id) where institution_id is not null;

create table public.opportunity_careers (
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  career_id      text not null references public.careers (id) on update cascade on delete cascade,
  primary key (opportunity_id, career_id)
);
create index opportunity_careers_career_idx on public.opportunity_careers (career_id);

create table public.opportunity_reports (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  user_id        uuid references public.profiles (id) on delete set null,
  reason         text not null check (reason in ('broken_link', 'expired', 'wrong_info', 'scam_or_unsafe', 'duplicate', 'other')),
  details        text check (char_length(details) <= 2000),
  status         text not null default 'open' check (status in ('open', 'triaged', 'resolved', 'dismissed')),
  resolved_by    uuid references public.profiles (id) on delete set null,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index opportunity_reports_open_idx on public.opportunity_reports (opportunity_id) where status in ('open', 'triaged');
create index opportunity_reports_user_idx on public.opportunity_reports (user_id);

-- Editorial / curation work queue.
create table public.review_queue (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in (
                'career', 'career_country_data', 'institution', 'program', 'opportunity',
                'opportunity_report', 'ai_generation', 'instrument_version', 'other')),
  entity_id   text not null,
  reason      text not null check (reason in ('new_submission', 'stale', 'user_report', 'ai_flagged', 'validation_failed', 'other')),
  priority    smallint not null default 3 check (priority between 1 and 5),   -- 1 = urgent
  status      text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'dismissed')),
  assigned_to uuid references public.profiles (id) on delete set null,
  due_at      timestamptz,
  notes       text,
  payload     jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index review_queue_work_idx on public.review_queue (priority, due_at) where status in ('open', 'in_progress');
create index review_queue_entity_idx on public.review_queue (entity_type, entity_id);

-- Every user report lands in the review queue (SECURITY DEFINER: reporters
-- cannot see or write the queue themselves).
create function public.enqueue_opportunity_report() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.review_queue (entity_type, entity_id, reason, priority, payload)
  values ('opportunity', new.opportunity_id::text, 'user_report',
          case new.reason when 'scam_or_unsafe' then 1 else 3 end,
          jsonb_build_object('report_id', new.id, 'report_reason', new.reason));
  return new;
end $$;

create trigger opportunity_reports_enqueue
  after insert on public.opportunity_reports
  for each row execute function public.enqueue_opportunity_report();
