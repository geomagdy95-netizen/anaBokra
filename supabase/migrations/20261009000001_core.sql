-- =============================================================================
-- anaBokra MX-04 / 01  CORE: enums, shared helpers, identity
--   profiles, admin_roles, parent_links, organizations, org_members
-- Conventions
--   * uuid PKs (gen_random_uuid) except content tables, which use text slugs
--   * every table has created_at; mutable ones have updated_at (trigger added
--     in the finalize migration)
--   * i18n values are jsonb {"en": "...", "ar": "..."} (see is_i18n)
--   * RLS is enabled + policies written in the _rls migration
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('student', 'parent', 'counselor', 'school_admin', 'admin');

-- Back-office capabilities. A user is "admin" (profiles.role) AND holds >= 1 of these.
create type public.admin_role as enum (
  'super_admin', 'content_editor', 'data_curator', 'assessment_lead', 'support', 'analyst'
);

create type public.consent_route  as enum ('teen_invite', 'parent_account', 'school');
create type public.consent_method as enum (
  'whatsapp_link', 'email_link',      -- teen_invite
  'in_app',                           -- parent_account
  'school_attestation', 'paper_form'  -- school
);

create type public.content_status as enum ('draft', 'review', 'published', 'archived');
create type public.opportunity_type as enum (
  'course', 'bootcamp', 'scholarship', 'internship', 'competition', 'event', 'job'
);
create type public.source_type as enum (
  'official_site', 'partner_feed', 'curated', 'user_submitted', 'press'
);

-- ---------------------------------------------------------------------------
-- Shared helper functions (no table dependencies)
-- ---------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- {"en": "...", "ar": "..."} (arF optional feminine variant). Empty strings allowed (drafts).
create function public.is_i18n(j jsonb) returns boolean
language sql immutable parallel safe as $$
  select j is not null
     and jsonb_typeof(j) = 'object'
     and jsonb_typeof(j -> 'en') = 'string'
     and jsonb_typeof(j -> 'ar') = 'string'
$$;

-- Same, but NULL is accepted.
create function public.is_i18n_or_null(j jsonb) returns boolean
language sql immutable parallel safe as $$
  select j is null or public.is_i18n(j)
$$;

-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  role                    public.user_role not null default 'student',
  display_name            text not null default '' check (char_length(display_name) <= 100),
  avatar_key              text,
  locale                  text not null default 'ar' check (locale in ('ar', 'en')),
  gender                  text check (gender in ('female', 'male')),       -- drives Arabic feminine forms (arF)
  date_of_birth           date check (date_of_birth > date '1900-01-01' and date_of_birth <= current_date),
  country_code            char(2) not null default 'EG' check (country_code ~ '^[A-Z]{2}$'),
  governorate             text,
  school_name             text,
  grade                   smallint check (grade between 1 and 12),
  -- UserContext (engine types.ts)
  curriculum              text check (curriculum in ('thanaweya', 'igcse', 'american', 'ib', 'other')),
  track                   text,
  expected_score_pct      numeric(5, 2) check (expected_score_pct between 0 and 100),
  budget                  text check (budget in ('low', 'medium', 'high')),
  phone                   text check (phone ~ '^\+[1-9][0-9]{7,14}$'),      -- E.164, for WhatsApp notifications
  onboarding_completed_at timestamptz,
  last_seen_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- admin_roles  (back-office capabilities; user may hold several)
-- ---------------------------------------------------------------------------
create table public.admin_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.admin_role not null,
  granted_by  uuid references public.profiles (id) on delete set null,
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, role),
  check (revoked_at is null or revoked_at >= granted_at)
);
create index admin_roles_active_idx on public.admin_roles (user_id) where revoked_at is null;

-- ---------------------------------------------------------------------------
-- organizations / org_members  (B2B, phase 2 ready)
-- ---------------------------------------------------------------------------
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  type          text not null default 'school' check (type in ('school', 'company', 'ngo', 'university')),
  name          jsonb not null check (public.is_i18n(name)),
  slug          text unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  country_code  char(2) not null default 'EG' check (country_code ~ '^[A-Z]{2}$'),
  city          text,
  contact_email text,
  status        text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  settings      jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.org_members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text not null check (role in ('owner', 'admin', 'counselor', 'teacher', 'student', 'parent')),
  status     text not null default 'invited' check (status in ('invited', 'active', 'removed')),
  cohort     text,                                   -- class / graduating year label
  joined_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index org_members_user_idx on public.org_members (user_id) where status = 'active';

-- ---------------------------------------------------------------------------
-- parent_links  (parent <-> student; two-sided handshake)
-- ---------------------------------------------------------------------------
create table public.parent_links (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid not null references public.profiles (id) on delete cascade,
  student_id   uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,  -- who initiated; the OTHER side must accept
  relation     text check (relation in ('mother', 'father', 'legal_guardian', 'other')),
  status       text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  verified_at  timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (parent_id, student_id),
  check (parent_id <> student_id),
  check (requested_by in (parent_id, student_id))
);
create index parent_links_student_idx on public.parent_links (student_id) where status = 'active';

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER so RLS policies can consult tables
-- the caller cannot read themselves, without recursion)
-- ---------------------------------------------------------------------------

-- Does the CURRENT user hold the given back-office role? super_admin implies every role.
create function public.has_admin_role(p_role public.admin_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.admin_roles ar
     where ar.user_id = auth.uid()
       and ar.revoked_at is null
       and (ar.role = p_role or ar.role = 'super_admin')
  )
$$;

create function public.has_any_admin_role(p_roles public.admin_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.admin_roles ar
     where ar.user_id = auth.uid()
       and ar.revoked_at is null
       and (ar.role = any (p_roles) or ar.role = 'super_admin')
  )
$$;

-- Content tables: written by content_editor or data_curator (and super_admin).
create function public.can_edit_content() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_any_admin_role(array['content_editor', 'data_curator']::public.admin_role[])
$$;

-- Under 18 (or unknown birth date => treated as a minor, fail-safe).
create function public.is_minor(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.date_of_birth > (current_date - interval '18 years')::date from public.profiles p where p.id = p_user),
    true
  )
$$;

-- Active parent link between the CURRENT user (parent) and the given student.
create function public.is_linked_parent(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.parent_links pl
     where pl.parent_id = auth.uid() and pl.student_id = p_student and pl.status = 'active'
  )
$$;

create function public.is_org_staff(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.org_members m
      join public.organizations o on o.id = m.org_id
     where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active'
       and m.role in ('owner', 'admin', 'counselor', 'teacher') and o.status = 'active'
  )
$$;

create function public.is_org_admin(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.org_members m
     where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active'
       and m.role in ('owner', 'admin')
  )
$$;

-- ---------------------------------------------------------------------------
-- Triggers: signup, guards
-- ---------------------------------------------------------------------------

-- Create a profile for every new auth user. Self-service roles are limited to
-- student | parent; counselor / school_admin / admin are assigned by back-office.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_role public.user_role;
begin
  v_role := case lower(coalesce(new.raw_user_meta_data ->> 'role', 'student'))
              when 'parent' then 'parent'::public.user_role
              else 'student'::public.user_role
            end;
  insert into public.profiles (id, role, display_name, locale)
  values (
    new.id, v_role,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, ''), '@', 1)), 100),
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'ar' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- End users cannot promote themselves or rewrite their birth date (minor gate).
-- Contexts without an end-user (service_role, migrations: auth.uid() is null)
-- and super_admin are unrestricted.
create function public.profiles_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null or public.has_admin_role('super_admin') then
    return new;
  end if;
  if new.id <> old.id then
    raise exception 'profiles.id is immutable' using errcode = '42501';
  end if;
  if new.role is distinct from old.role then
    raise exception 'profiles.role can only be changed by a super_admin' using errcode = '42501';
  end if;
  if old.date_of_birth is not null and new.date_of_birth is distinct from old.date_of_birth then
    raise exception 'date_of_birth is locked once set; contact support' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- admin_roles may only be granted to profiles with role = admin; track the grantor.
create function public.admin_roles_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.profiles p where p.id = new.user_id and p.role = 'admin') then
      raise exception 'admin roles can only be granted to profiles with role = admin' using errcode = '23514';
    end if;
    new.granted_by := coalesce(new.granted_by, auth.uid());
  else
    if new.user_id <> old.user_id or new.role <> old.role then
      raise exception 'user_id/role are immutable; revoke and grant a new row' using errcode = '42501';
    end if;
    if old.revoked_at is not null and new.revoked_at is null then
      raise exception 'revocation is final; grant the role again with a new row after deleting the old one (service role)' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger admin_roles_guard
  before insert or update on public.admin_roles
  for each row execute function public.admin_roles_guard();

-- parent_links: role sanity on insert, one-way state machine on update.
create function public.parent_links_validate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.profiles where id = new.parent_id and role = 'parent') then
      raise exception 'parent_id must be a parent profile' using errcode = '23514';
    end if;
    if not exists (select 1 from public.profiles where id = new.student_id and role = 'student') then
      raise exception 'student_id must be a student profile' using errcode = '23514';
    end if;
    if auth.uid() is not null and not public.has_admin_role('support') then
      new.status := 'pending';           -- end users can only request
      new.verified_at := null;
      new.revoked_at := null;
    end if;
    return new;
  end if;

  -- UPDATE
  if auth.uid() is null or public.has_admin_role('super_admin') then
    return new;
  end if;
  if new.parent_id <> old.parent_id or new.student_id <> old.student_id or new.requested_by <> old.requested_by then
    raise exception 'link parties are immutable' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if old.status = 'revoked' then
      raise exception 'a revoked link is final; create a new request' using errcode = '42501';
    elsif new.status = 'active' then
      -- only the side that did NOT request may accept
      if old.status <> 'pending' or auth.uid() = old.requested_by
         or auth.uid() not in (old.parent_id, old.student_id) then
        raise exception 'only the invited side can accept a pending link' using errcode = '42501';
      end if;
      new.verified_at := now();
    elsif new.status = 'revoked' then
      new.revoked_at := now();
    else
      raise exception 'invalid link status transition' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger parent_links_validate
  before insert or update on public.parent_links
  for each row execute function public.parent_links_validate();
