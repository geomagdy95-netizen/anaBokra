-- =============================================================================
-- anaBokra MX-04 / 06  PLATFORM
--   feature_flags, app_settings, audit_log, ai_generations
--   prepared for phase 2-3: counselors, bookings, subscriptions
-- =============================================================================

create table public.feature_flags (
  key         text primary key check (key ~ '^[a-z][a-z0-9_.]*$'),
  enabled     boolean not null default false,
  rollout_pct smallint not null default 100 check (rollout_pct between 0 and 100),
  audience    jsonb not null default '{}'::jsonb check (jsonb_typeof(audience) = 'object'),  -- {roles:[], locales:[], org_ids:[]}
  description text,
  updated_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.app_settings (
  key         text primary key check (key ~ '^[a-z][a-z0-9_.]*$'),
  value       jsonb not null,
  is_public   boolean not null default false,       -- readable by anon (e.g. current_policy_version)
  description text,
  updated_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- audit_log: append-only. Rows are written by audit_row_change() triggers
-- (SECURITY DEFINER) and by service_role; nobody can update or delete.
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid,                      -- auth.uid(); NULL for service_role / migrations (no FK: survives user deletion)
  actor_role  text,                      -- JWT role: authenticated | service_role | ...
  action      text not null check (action in ('insert', 'update', 'delete', 'publish', 'export', 'login', 'other')),
  entity_type text not null,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  context     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
create index audit_log_actor_idx  on public.audit_log (actor_id, created_at desc);
create index audit_log_time_idx   on public.audit_log (created_at desc);

create function public.audit_log_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_log is append-only' using errcode = '42501';
end $$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function public.audit_log_append_only();

-- Generic row auditor. Usage: execute function public.audit_row_change('id')
-- or with a composite key: audit_row_change('career_id', 'country_code').
create function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_before jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_after  jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row    jsonb := coalesce(v_after, v_before);
  v_id     text;
begin
  if tg_op = 'UPDATE' and (v_before - 'updated_at') = (v_after - 'updated_at') then
    return null;                         -- no-op update
  end if;
  select string_agg(coalesce(v_row ->> a, ''), ':' order by ord)
    into v_id from unnest(tg_argv) with ordinality as t(a, ord);
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, before, after)
  values (auth.uid(), auth.role(), lower(tg_op), tg_table_name, v_id,
          v_before - 'token_hash', v_after - 'token_hash');
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- ai_generations: cost + safety ledger for every LLM call (no raw prompts;
-- only an excerpt of FLAGGED output is kept, for human review).
-- ---------------------------------------------------------------------------
create table public.ai_generations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles (id) on delete set null,
  feature          text not null,                               -- career_explainer | roadmap_draft | content_translate ...
  prompt_key       text not null,
  prompt_version   text not null default '1',
  model            text not null,
  input_tokens     integer check (input_tokens >= 0),
  output_tokens    integer check (output_tokens >= 0),
  cost_usd         numeric(10, 6) not null default 0 check (cost_usd >= 0),
  latency_ms       integer check (latency_ms >= 0),
  flagged          boolean not null default false,
  flag_reason      text,
  flag_resolved_at timestamptz,
  flag_resolved_by uuid references public.profiles (id) on delete set null,
  output_excerpt   text check (char_length(output_excerpt) <= 4000),
  context          jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),   -- non-PII refs: career_id, result_id
  created_at       timestamptz not null default now(),
  check (not flagged or flag_reason is not null)
);
create index ai_generations_user_idx on public.ai_generations (user_id, created_at desc);
create index ai_generations_flagged_idx on public.ai_generations (created_at desc) where flagged and flag_resolved_at is null;
create index ai_generations_cost_idx on public.ai_generations (created_at, model);

create function public.enqueue_ai_flag() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.flagged and (tg_op = 'INSERT' or not old.flagged) then
    insert into public.review_queue (entity_type, entity_id, reason, priority, payload)
    values ('ai_generation', new.id::text, 'ai_flagged', 2,
            jsonb_build_object('feature', new.feature, 'prompt_key', new.prompt_key, 'flag_reason', new.flag_reason));
  end if;
  return null;
end $$;

create trigger ai_generations_enqueue_flag
  after insert or update of flagged on public.ai_generations
  for each row execute function public.enqueue_ai_flag();

-- ---------------------------------------------------------------------------
-- Phase 2-3 (prepared): counselors, bookings, subscriptions
-- ---------------------------------------------------------------------------
create table public.counselors (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  headline        jsonb check (public.is_i18n_or_null(headline)),
  bio             jsonb check (public.is_i18n_or_null(bio)),
  specialties     text[] not null default '{}',
  languages       text[] not null default '{ar}',
  hourly_rate     numeric(10, 2) check (hourly_rate >= 0),
  currency        char(3) not null default 'EGP' check (currency ~ '^[A-Z]{3}$'),
  rating_avg      numeric(3, 2) check (rating_avg between 0 and 5),
  status          text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index counselors_active_idx on public.counselors (status) where status = 'active';

create table public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references public.profiles (id) on delete set null,
  organization_id      uuid references public.organizations (id) on delete set null,
  plan                 text not null,                              -- family_plus | school_basic | ...
  status               text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  provider             text not null default 'manual',             -- paymob | fawry | stripe | manual
  provider_ref         text,
  seats                integer check (seats > 0),
  amount               numeric(12, 2) check (amount >= 0),
  currency             char(3) not null default 'EGP' check (currency ~ '^[A-Z]{3}$'),
  current_period_start timestamptz,
  current_period_end   timestamptz,
  cancel_at            timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check ((user_id is not null) <> (organization_id is not null)),     -- personal XOR organisational
  check (current_period_end is null or current_period_start is null or current_period_end > current_period_start)
);
create unique index subscriptions_provider_ref on public.subscriptions (provider, provider_ref) where provider_ref is not null;
create index subscriptions_user_idx on public.subscriptions (user_id) where user_id is not null;
create index subscriptions_org_idx  on public.subscriptions (organization_id) where organization_id is not null;

create table public.bookings (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.profiles (id) on delete cascade,
  counselor_id    uuid not null references public.counselors (user_id) on delete restrict,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  status          text not null default 'requested'
                  check (status in ('requested', 'confirmed', 'declined', 'cancelled', 'completed', 'no_show')),
  meeting_url     text check (meeting_url is null or meeting_url ~ '^https://'),
  student_note    text check (char_length(student_note) <= 1000),
  price           numeric(10, 2) check (price >= 0),
  currency        char(3) not null default 'EGP' check (currency ~ '^[A-Z]{3}$'),
  subscription_id uuid references public.subscriptions (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index bookings_student_idx   on public.bookings (student_id, starts_at desc);
create index bookings_counselor_idx on public.bookings (counselor_id, starts_at desc);
-- a counselor cannot be double-booked on the same start slot
create unique index bookings_slot_unique on public.bookings (counselor_id, starts_at) where status in ('requested', 'confirmed');

-- Counselors may edit their own listing but not status / rating.
create function public.counselors_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and not public.has_admin_role('support') then
      new.status := 'pending';
      new.rating_avg := null;
    end if;
    return new;
  end if;
  if auth.uid() is not null and not public.has_admin_role('support') then
    if new.status is distinct from old.status or new.rating_avg is distinct from old.rating_avg
       or new.organization_id is distinct from old.organization_id or new.user_id <> old.user_id then
      raise exception 'status / rating / organisation are managed by anaBokra staff' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger counselors_guard
  before insert or update on public.counselors
  for each row execute function public.counselors_guard();

-- Students may only cancel; counselors manage the lifecycle; nobody moves a
-- booking to another student / counselor / slot after creation (except staff).
create function public.bookings_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and not public.has_admin_role('support') then
      new.status := 'requested';
      new.meeting_url := null;
      new.price := null;
      new.subscription_id := null;
    end if;
    return new;
  end if;
  if auth.uid() is null or public.has_admin_role('support') then
    return new;
  end if;
  if new.student_id <> old.student_id or new.counselor_id <> old.counselor_id
     or new.starts_at <> old.starts_at or new.ends_at <> old.ends_at
     or new.price is distinct from old.price or new.subscription_id is distinct from old.subscription_id then
    raise exception 'bookings are immutable except status/meeting_url; cancel and rebook' using errcode = '42501';
  end if;
  if auth.uid() = old.student_id and auth.uid() <> old.counselor_id then
    if new.status is distinct from old.status and new.status <> 'cancelled' then
      raise exception 'students can only cancel a booking' using errcode = '42501';
    end if;
    if new.meeting_url is distinct from old.meeting_url then
      raise exception 'only the counselor sets the meeting url' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger bookings_guard
  before insert or update on public.bookings
  for each row execute function public.bookings_guard();

-- ---------------------------------------------------------------------------
-- Audit triggers on sensitive / editorial tables
-- ---------------------------------------------------------------------------
create trigger audit_admin_roles          after insert or update or delete on public.admin_roles          for each row execute function public.audit_row_change('id');
create trigger audit_organizations        after insert or update or delete on public.organizations        for each row execute function public.audit_row_change('id');
create trigger audit_org_members          after insert or update or delete on public.org_members          for each row execute function public.audit_row_change('id');
create trigger audit_parent_links         after insert or update or delete on public.parent_links         for each row execute function public.audit_row_change('id');
create trigger audit_consents             after insert or update or delete on public.consents             for each row execute function public.audit_row_change('id');
create trigger audit_instrument_versions  after insert or update or delete on public.instrument_versions  for each row execute function public.audit_row_change('id');
create trigger audit_clusters             after insert or update or delete on public.clusters             for each row execute function public.audit_row_change('id');
create trigger audit_careers              after insert or update or delete on public.careers              for each row execute function public.audit_row_change('id');
create trigger audit_career_country_data  after insert or update or delete on public.career_country_data  for each row execute function public.audit_row_change('career_id', 'country_code');
create trigger audit_institutions         after insert or update or delete on public.institutions         for each row execute function public.audit_row_change('id');
create trigger audit_programs             after insert or update or delete on public.programs             for each row execute function public.audit_row_change('id');
create trigger audit_opportunities        after insert or update or delete on public.opportunities        for each row execute function public.audit_row_change('id');
create trigger audit_achievements         after insert or update or delete on public.achievements         for each row execute function public.audit_row_change('id');
create trigger audit_feature_flags        after insert or update or delete on public.feature_flags        for each row execute function public.audit_row_change('key');
create trigger audit_app_settings         after insert or update or delete on public.app_settings         for each row execute function public.audit_row_change('key');
create trigger audit_counselors           after insert or update or delete on public.counselors           for each row execute function public.audit_row_change('user_id');
create trigger audit_subscriptions        after insert or update or delete on public.subscriptions        for each row execute function public.audit_row_change('id');
