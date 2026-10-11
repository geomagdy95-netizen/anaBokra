-- =============================================================================
-- Anonymous statistics (phase 1, consent-texts §1.6)
--
-- One row per finished assessment, sent only with the user's opt-in (the parent's for
-- 15-17). The row has no user id, device id, IP address or timestamp: only the ISO week
-- it arrived in. Written by the web backend with the service role; nobody else can read
-- or write it.
-- =============================================================================

create table public.anon_stats (
  id            bigint generated always as identity primary key,
  received_week text not null check (received_week ~ '^\d{4}-W\d{2}$'),
  age_band      text not null check (age_band in ('15-17', '18-20', '21-25', '26plus')),
  stage         text check (stage in ('school', 'university', 'graduate')),
  locale        text not null check (locale in ('ar', 'en')),
  completion    smallint not null check (completion between 0 and 4),
  top_interests text[] not null default '{}' check (cardinality(top_interests) <= 3),
  top_groups    text[] not null default '{}' check (cardinality(top_groups) <= 3),
  top_values    text[] not null default '{}' check (cardinality(top_values) <= 3),
  bands         jsonb not null default '{}'::jsonb check (jsonb_typeof(bands) = 'object'),
  event_code    text check (event_code ~ '^[A-Z0-9-]{3,20}$')
);

create index anon_stats_week_idx on public.anon_stats (received_week);
create index anon_stats_event_idx on public.anon_stats (event_code) where event_code is not null;

alter table public.anon_stats enable row level security;
revoke all on public.anon_stats from public, anon, authenticated;
grant select, insert on public.anon_stats to service_role;
grant usage on sequence public.anon_stats_id_seq to service_role;
