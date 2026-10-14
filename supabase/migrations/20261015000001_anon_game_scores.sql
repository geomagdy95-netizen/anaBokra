-- Anonymous game scores for comparisons with other players (docs/product/games.md).
-- Sent only with the user's opt-in to anonymous statistics; first play only. No identifiers, no
-- exact time: the ISO week it arrived, the coarse sender fields, the game, its version and the score.

create table if not exists public.anon_game_scores (
  id bigint generated always as identity primary key,
  received_week text not null,
  age_band text not null check (age_band in ('15-17', '18-20', '21-25', '26plus')),
  stage text check (stage in ('school', 'university', 'graduate')),
  locale text not null check (locale in ('ar', 'en')),
  event_code text,
  game text not null check (game in ('pattern', 'numbers', 'rotation', 'memory')),
  game_version smallint not null,
  score smallint not null check (score between 0 and 20)
);

alter table public.anon_game_scores enable row level security;
-- No policies: only the service role (the server) reads or writes.

-- The spread phones download: players per game, age band and score, current game version only.
create or replace view public.anon_game_norms as
  select game, age_band, score, count(*)::int as players
  from public.anon_game_scores
  where game_version = 1
  group by game, age_band, score;

revoke all on public.anon_game_norms from anon, authenticated;
