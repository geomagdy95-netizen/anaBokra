-- =============================================================================
-- Journey milestones, career interest, usage counts and feedback (phase 1, consent-texts §1.6 and
-- §1.8, docs/product/analytics.md)
--
-- Anonymous statistics, sent only with the user's opt-in, like public.anon_stats:
--   anon_steps:        one row per milestone a phone reached (once each), for drop-off between steps.
--   anon_career_views: one row per career page a phone opened (once per career), for interest.
--   anon_usage:        at most one row per phone per day, with counts of map and page actions.
-- Feedback, sent only when the user presses Send (a separate, explicit choice):
--   anon_feedback:     a rating, choices and optional free text (cleaned of e-mails, links and
--                      long digit runs on the phone and again on the server).
-- No row has a user id, device id, IP address or timestamp: only the ISO week it arrived in. Rows
-- can't be linked to each other or to other tables. Written by the web backend with the service role;
-- nobody else can read or write them.
-- =============================================================================

create table public.anon_steps (
  id            bigint generated always as identity primary key,
  received_week text not null check (received_week ~ '^\d{4}-W\d{2}$'),
  age_band      text not null check (age_band in ('15-17', '18-20', '21-25', '26plus')),
  stage         text check (stage in ('school', 'university', 'graduate')),
  locale        text not null check (locale in ('ar', 'en')),
  event_code    text check (event_code ~ '^[A-Z0-9-]{3,20}$'),
  step          text not null check (step in ('discover_task', 'discover_done', 'results_viewed', 'path_started', 'quest_started', 'quest_done', 'career_chosen', 'situation_answered')),
  n             smallint check (n between 1 and 10),
  path_group    text check (path_group ~ '^[a-z][a-z0-9_]{1,40}$'),
  career        text check (career ~ '^[a-z][a-z0-9_]{1,60}$')
);

create table public.anon_career_views (
  id            bigint generated always as identity primary key,
  received_week text not null check (received_week ~ '^\d{4}-W\d{2}$'),
  age_band      text not null check (age_band in ('15-17', '18-20', '21-25', '26plus')),
  stage         text check (stage in ('school', 'university', 'graduate')),
  locale        text not null check (locale in ('ar', 'en')),
  event_code    text check (event_code ~ '^[A-Z0-9-]{3,20}$'),
  career        text not null check (career ~ '^[a-z][a-z0-9_]{1,60}$')
);

create table public.anon_usage (
  id            bigint generated always as identity primary key,
  received_week text not null check (received_week ~ '^\d{4}-W\d{2}$'),
  age_band      text not null check (age_band in ('15-17', '18-20', '21-25', '26plus')),
  stage         text check (stage in ('school', 'university', 'graduate')),
  locale        text not null check (locale in ('ar', 'en')),
  event_code    text check (event_code ~ '^[A-Z0-9-]{3,20}$'),
  counts        jsonb not null check (jsonb_typeof(counts) = 'object')
);

create table public.anon_feedback (
  id            bigint generated always as identity primary key,
  received_week text not null check (received_week ~ '^\d{4}-W\d{2}$'),
  age_band      text not null check (age_band in ('15-17', '18-20', '21-25', '26plus')),
  stage         text check (stage in ('school', 'university', 'graduate')),
  locale        text not null check (locale in ('ar', 'en')),
  event_code    text check (event_code ~ '^[A-Z0-9-]{3,20}$'),
  screen        text not null check (screen in ('results', 'career', 'map', 'account', 'path')),
  career        text check (career ~ '^[a-z][a-z0-9_]{1,60}$'),
  rating        smallint check (rating between 1 and 5),
  liked         text[] not null default '{}',
  confusing     text[] not null default '{}',
  text          text check (char_length(text) <= 500)
);

create index anon_steps_step_idx on public.anon_steps (step);
create index anon_steps_event_idx on public.anon_steps (event_code) where event_code is not null;
create index anon_career_views_career_idx on public.anon_career_views (career);
create index anon_usage_week_idx on public.anon_usage (received_week);
create index anon_feedback_week_idx on public.anon_feedback (received_week);

alter table public.anon_steps enable row level security;
alter table public.anon_career_views enable row level security;
alter table public.anon_usage enable row level security;
alter table public.anon_feedback enable row level security;
revoke all on public.anon_steps, public.anon_career_views, public.anon_usage, public.anon_feedback from public, anon, authenticated;
grant select, insert on public.anon_steps, public.anon_career_views, public.anon_usage, public.anon_feedback to service_role;
grant usage on sequence public.anon_steps_id_seq, public.anon_career_views_id_seq, public.anon_usage_id_seq, public.anon_feedback_id_seq to service_role;
