-- =============================================================================
-- anaBokra MX-04 / 05  ENGAGEMENT
--   favorites, saved_opportunities, roadmaps, milestones, xp_events,
--   achievements, user_achievements, weekly_goals, notifications, notification_prefs
-- =============================================================================

create table public.favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  career_id  text not null references public.careers (id) on update cascade on delete cascade,
  note       text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  primary key (user_id, career_id)
);
create index favorites_career_idx on public.favorites (career_id);

create table public.saved_opportunities (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  status         text not null default 'saved' check (status in ('saved', 'applied', 'accepted', 'rejected', 'dismissed')),
  note           text check (char_length(note) <= 500),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);
create index saved_opportunities_opp_idx on public.saved_opportunities (opportunity_id);

create table public.roadmaps (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  career_id   text references public.careers (id) on update cascade on delete set null,
  title       text not null check (char_length(title) between 1 and 200),
  status      text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  target_date date,
  data        jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),   -- chosen route, track, notes
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index roadmaps_user_idx on public.roadmaps (user_id, status);

create table public.milestones (
  id             uuid primary key default gen_random_uuid(),
  roadmap_id     uuid not null references public.roadmaps (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 200),
  description    text check (char_length(description) <= 2000),
  due_date       date,
  status         text not null default 'todo' check (status in ('todo', 'doing', 'done', 'skipped')),
  completed_at   timestamptz,
  sort_order     integer not null default 0,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  xp_reward      integer not null default 0 check (xp_reward between 0 and 1000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check ((status = 'done') = (completed_at is not null))
);
create index milestones_roadmap_idx on public.milestones (roadmap_id, sort_order);
create index milestones_user_idx on public.milestones (user_id, status);

-- Append-only ledger. Written by the backend (service_role) only, so XP cannot
-- be self-awarded from the client.
create table public.xp_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  event_type      text not null check (char_length(event_type) between 1 and 60),  -- station_completed, milestone_done, streak_week ...
  points          integer not null check (points <> 0),
  ref_type        text,
  ref_id          text,
  idempotency_key text,
  created_at      timestamptz not null default now()
);
create index xp_events_user_idx on public.xp_events (user_id, created_at desc);
create unique index xp_events_idem on public.xp_events (user_id, idempotency_key) where idempotency_key is not null;

create table public.achievements (
  id          text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  name        jsonb not null check (public.is_i18n(name)),
  description jsonb check (public.is_i18n_or_null(description)),
  icon        text,
  xp_reward   integer not null default 0 check (xp_reward >= 0),
  criteria    jsonb not null default '{}'::jsonb check (jsonb_typeof(criteria) = 'object'),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.user_achievements (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on update cascade on delete cascade,
  earned_at      timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.weekly_goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  week_start   date not null,
  goal_type    text not null check (char_length(goal_type) between 1 and 60),   -- explore_careers, finish_station, complete_milestone ...
  target       integer not null check (target between 1 and 100),
  progress     integer not null default 0 check (progress >= 0),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, week_start, goal_type)
);

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  kind          text not null check (char_length(kind) between 1 and 60),   -- new_match, deadline_soon, weekly_digest, achievement ...
  channel       text not null default 'in_app' check (channel in ('in_app', 'push', 'email', 'whatsapp')),
  title         jsonb check (public.is_i18n_or_null(title)),
  body          jsonb check (public.is_i18n_or_null(body)),
  data          jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  scheduled_for timestamptz not null default now(),
  sent_at       timestamptz,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index notifications_inbox_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_due_idx on public.notifications (scheduled_for) where sent_at is null;

create table public.notification_prefs (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  in_app        boolean not null default true,
  push          boolean not null default false,
  email         boolean not null default false,
  whatsapp      boolean not null default false,
  weekly_digest boolean not null default true,
  quiet_hours   jsonb not null default '{"start": "22:00", "end": "08:00"}'::jsonb check (jsonb_typeof(quiet_hours) = 'object'),
  timezone      text not null default 'Africa/Cairo',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- A milestone's user must own its roadmap (checked for every writer, not just via RLS).
create function public.milestones_owner_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.roadmaps r where r.id = new.roadmap_id and r.user_id = new.user_id) then
    raise exception 'milestone user must own the roadmap' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger milestones_owner_check
  before insert or update of roadmap_id, user_id on public.milestones
  for each row execute function public.milestones_owner_check();
