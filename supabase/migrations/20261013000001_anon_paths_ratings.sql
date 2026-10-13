-- =============================================================================
-- Checked paths and the results rating (phase 1, consent-texts §1.6 and §2.3, pilot plan §7)
--
-- Anonymous statistics, sent only with the user's opt-in, like public.anon_stats:
--   anon_path_checks: one row per path a user checked (Verify), with its band only.
--   anon_ratings:     one row per user who answered "my results were clear and useful" (1-5).
-- Research, sent only by adults at a session that offers research, like research_answer_sets:
--   research_path_sets: one row per checked path, with that path's answers, its content version
--   and the draft score parts and band, so the weights and cut-offs can be set.
-- No row has a user id, device id, link code, IP address or timestamp: only the ISO week it
-- arrived in. Rows can't be linked to each other or to anon_stats. Written by the web backend
-- with the service role; nobody else can read or write them.
-- =============================================================================

create table public.anon_path_checks (
  id            bigint generated always as identity primary key,
  received_week text not null check (received_week ~ '^\d{4}-W\d{2}$'),
  age_band      text not null check (age_band in ('15-17', '18-20', '21-25', '26plus')),
  stage         text check (stage in ('school', 'university', 'graduate')),
  locale        text not null check (locale in ('ar', 'en')),
  event_code    text check (event_code ~ '^[A-Z0-9-]{3,20}$'),
  path_group    text not null check (path_group ~ '^[a-z][a-z0-9_]{1,40}$'),
  band          text not null check (band in ('fitsWell', 'fitsPartly', 'rethink'))
);

create table public.anon_ratings (
  id            bigint generated always as identity primary key,
  received_week text not null check (received_week ~ '^\d{4}-W\d{2}$'),
  age_band      text not null check (age_band in ('15-17', '18-20', '21-25', '26plus')),
  stage         text check (stage in ('school', 'university', 'graduate')),
  locale        text not null check (locale in ('ar', 'en')),
  event_code    text check (event_code ~ '^[A-Z0-9-]{3,20}$'),
  rating        smallint not null check (rating between 1 and 5)
);

create table public.research_path_sets (
  id            bigint generated always as identity primary key,
  received_week text not null check (received_week ~ '^\d{4}-W\d{2}$'),
  event_code    text not null references public.pilot_events (code),
  age_band      text not null check (age_band in ('18-20', '21-25', '26plus')),
  stage         text check (stage in ('school', 'university', 'graduate')),
  locale        text not null check (locale in ('ar', 'en')),
  path_id       text not null check (path_id ~ '^[a-z][a-z0-9_]{1,40}$'),
  version       text not null,
  answers       jsonb not null check (jsonb_typeof(answers) = 'object'),
  components    jsonb not null check (jsonb_typeof(components) = 'object'),
  band          text not null check (band in ('fitsWell', 'fitsPartly', 'rethink')),
  delete_by     date not null default date '2027-06-17'
);

create index anon_path_checks_event_idx on public.anon_path_checks (event_code) where event_code is not null;
create index anon_ratings_event_idx on public.anon_ratings (event_code) where event_code is not null;
create index research_path_sets_event_idx on public.research_path_sets (event_code);

alter table public.anon_path_checks enable row level security;
alter table public.anon_ratings enable row level security;
alter table public.research_path_sets enable row level security;
revoke all on public.anon_path_checks, public.anon_ratings, public.research_path_sets from public, anon, authenticated;
grant select, insert on public.anon_path_checks, public.anon_ratings to service_role;
grant select, insert, delete on public.research_path_sets to service_role;
grant usage on sequence public.anon_path_checks_id_seq, public.anon_ratings_id_seq, public.research_path_sets_id_seq to service_role;
