-- =============================================================================
-- University pilot: partner sessions and the research opt-in (consent-texts §2.2–2.3,
-- pilot-plan "Data"). Written and read only by the web backend with the service role.
--
-- research_answer_sets: one row per finished result, with no user id, device id, IP address,
--   key or timestamp; only the ISO week it arrived in. Cannot be linked to anything else.
-- research_readiness: the readiness answers before and after, paired by a random link code
--   made on the participant's phone. Only that phone knows the code (it can delete its rows).
-- Both are deleted once the analysis is done, and no later than 17 June 2027.
-- =============================================================================

create table public.pilot_events (
  code       text primary key check (code ~ '^[A-Z0-9][A-Z0-9-]{2,19}$'),
  partner    text not null,
  -- Whether the research opt-in is offered (some partners may need an approval first).
  research   boolean not null default false,
  opens_on   date,
  closes_on  date,
  created_at timestamptz not null default now(),
  check (closes_on is null or opens_on is null or closes_on >= opens_on)
);

create table public.research_answer_sets (
  id             bigint generated always as identity primary key,
  received_week  text not null check (received_week ~ '^\d{4}-W\d{2}$'),
  event_code     text not null references public.pilot_events (code),
  age_band       text not null check (age_band in ('18-20', '21-25', '26plus')),
  stage          text check (stage in ('school', 'university', 'graduate')),
  locale         text not null check (locale in ('ar', 'en')),
  versions       jsonb not null check (jsonb_typeof(versions) = 'object'),
  answers        jsonb not null check (jsonb_typeof(answers) = 'object'),
  values_ranking text[] not null default '{}' check (cardinality(values_ranking) <= 6),
  delete_by      date not null default date '2027-06-17'
);

create table public.research_readiness (
  link_code     text not null check (link_code ~ '^[0-9A-HJKMNP-TV-Z]{26}$'),
  phase         text not null check (phase in ('pre', 'post')),
  received_week text not null check (received_week ~ '^\d{4}-W\d{2}$'),
  event_code    text not null references public.pilot_events (code),
  version       text not null,
  locale        text not null check (locale in ('ar', 'en')),
  answers       jsonb not null check (jsonb_typeof(answers) = 'object'),
  delete_by     date not null default date '2027-06-17',
  primary key (link_code, phase)
);

create index research_answer_sets_event_idx on public.research_answer_sets (event_code);
create index research_readiness_event_idx on public.research_readiness (event_code);

alter table public.pilot_events enable row level security;
alter table public.research_answer_sets enable row level security;
alter table public.research_readiness enable row level security;
revoke all on public.pilot_events, public.research_answer_sets, public.research_readiness from public, anon, authenticated;
grant select, insert, update, delete on public.pilot_events to service_role;
grant select, insert, delete on public.research_answer_sets to service_role;
grant select, insert, update, delete on public.research_readiness to service_role;
grant usage on sequence public.research_answer_sets_id_seq to service_role;
