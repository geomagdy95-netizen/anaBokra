-- =============================================================================
-- anaBokra MX-13  CONSENT FLOWS (three routes, one consent record)
--
--   * consent_invites: opened_at / declined_at / sends (send log for the
--     "max 3 resends per day" rule and the sent/opened status on the teen's screen)
--   * org_join_codes: class codes students use to join a school (route C)
--   * service-role functions used by the web backend (the guardian has no
--     end-user JWT on these paths, so they can never be called by anon/authenticated):
--       consent_invite_create / _register_send / _lookup / _mark_opened / _decline / _confirm
--       family_add_child     (route B: child profile + active link + parent_account consent, atomically)
--       org_join_by_code     (route C: student joins a class)
--   Tokens are passed as the HEX of their SHA-256 (the raw token never reaches the DB from this path).
--   The older create_consent_invite()/redeem_consent_invite() stay valid (same hash scheme).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- consent_invites: state columns
--   status is derived (see apps/web/src/server/consent/state.ts):
--     pending -> opened -> granted (used_at) | declined (declined_at) | expired | revoked
-- ---------------------------------------------------------------------------
alter table public.consent_invites
  add column opened_at   timestamptz,
  add column declined_at timestamptz,
  add column sends       timestamptz[] not null default '{}';

alter table public.consent_invites
  add constraint consent_invites_final_state check (declined_at is null or used_at is null);

grant select (opened_at, declined_at, sends) on public.consent_invites to authenticated;

-- ---------------------------------------------------------------------------
-- org_join_codes  (route C: "class code" students type to join a school)
-- ---------------------------------------------------------------------------
create table public.org_join_codes (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  code       text not null unique check (code ~ '^[A-Z0-9]{6,12}$'),
  cohort     text check (char_length(cohort) <= 100),   -- class / graduating year label copied to org_members.cohort
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index org_join_codes_org_idx on public.org_join_codes (org_id);

alter table public.org_join_codes enable row level security;
create policy org_join_codes_select on public.org_join_codes for select to authenticated
  using (public.is_org_admin(org_id) or public.has_admin_role('support'));
create policy org_join_codes_insert on public.org_join_codes for insert to authenticated
  with check (public.is_org_admin(org_id) or public.has_admin_role('super_admin'));
create policy org_join_codes_update on public.org_join_codes for update to authenticated
  using (public.is_org_admin(org_id) or public.has_admin_role('super_admin'))
  with check (public.is_org_admin(org_id) or public.has_admin_role('super_admin'));
-- no DELETE: revoke instead. Students never read this table; they join through org_join_by_code().
grant select, insert on public.org_join_codes to authenticated;
grant update (cohort, expires_at, revoked_at) on public.org_join_codes to authenticated;

-- ---------------------------------------------------------------------------
-- Invite lifecycle (service_role only)
-- ---------------------------------------------------------------------------
create function public.consent_invite_create(
  p_student  uuid,
  p_whatsapp text,
  p_hint     text,
  p_hash_hex text,
  p_ttl      interval default interval '7 days'
) returns table (invite_id uuid, invite_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_id  uuid;
  v_exp timestamptz := now() + p_ttl;
begin
  if not exists (select 1 from public.profiles where id = p_student and role = 'student') then
    raise exception 'only students can invite a guardian' using errcode = '42501';
  end if;
  if p_ttl <= interval '0' or p_ttl > interval '30 days' then
    raise exception 'ttl must be within (0, 30 days]' using errcode = '22023';
  end if;
  if p_hash_hex !~ '^[0-9a-f]{64}$' then
    raise exception 'token hash must be 64 hex characters' using errcode = '22023';
  end if;
  -- a student asking again (new number) revokes their still-open invites first, so at most one is live
  update public.consent_invites
     set revoked_at = now()
   where student_id = p_student and used_at is null and revoked_at is null and declined_at is null and expires_at > now();
  -- abuse brake: new invites per rolling day (resending an existing invite is limited separately)
  if (select count(*) from public.consent_invites i where i.student_id = p_student and i.created_at > now() - interval '1 day') >= 6 then
    raise exception 'too many invites today' using errcode = '54000';
  end if;
  insert into public.consent_invites (student_id, channel, whatsapp_number, guardian_hint, token_hash, expires_at)
  values (p_student, 'whatsapp', p_whatsapp, left(p_hint, 100), decode(p_hash_hex, 'hex'), v_exp)
  returning id into v_id;
  return query select v_id, v_exp;
end $$;

-- Atomically check the daily send budget (1 first send + p_max_resends) and log the send.
create function public.consent_invite_register_send(p_invite uuid, p_max_resends int default 3)
returns table (send_count int, sends_last_day int)
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.consent_invites;
  v_day int;
begin
  select * into v_inv from public.consent_invites where id = p_invite for update;
  if not found or v_inv.used_at is not null or v_inv.revoked_at is not null
     or v_inv.declined_at is not null or v_inv.expires_at <= now() then
    raise exception 'invite_not_active' using errcode = 'P0001';
  end if;
  select count(*) into v_day from unnest(v_inv.sends) s where s > now() - interval '1 day';
  if v_day >= 1 + p_max_resends then
    raise exception 'resend_limit' using errcode = '54000';
  end if;
  update public.consent_invites set sends = sends || now() where id = p_invite;
  return query select cardinality(v_inv.sends) + 1, v_day + 1;
end $$;

create function public.consent_invite_lookup(p_hash_hex text)
returns table (
  invite_id uuid, student_id uuid, student_name text, whatsapp_number text, guardian_hint text,
  scope text[], created_at timestamptz, expires_at timestamptz, opened_at timestamptz, used_at timestamptz,
  revoked_at timestamptz, declined_at timestamptz, sends timestamptz[]
)
language sql stable security definer set search_path = '' as $$
  select i.id, i.student_id, p.display_name, i.whatsapp_number, i.guardian_hint, i.scope, i.created_at, i.expires_at,
         i.opened_at, i.used_at, i.revoked_at, i.declined_at, i.sends
    from public.consent_invites i
    join public.profiles p on p.id = i.student_id
   where p_hash_hex ~ '^[0-9a-f]{64}$' and i.token_hash = decode(p_hash_hex, 'hex')
$$;

create function public.consent_invite_mark_opened(p_hash_hex text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.consent_invites
     set opened_at = coalesce(opened_at, now())
   where p_hash_hex ~ '^[0-9a-f]{64}$' and token_hash = decode(p_hash_hex, 'hex')
     and used_at is null and revoked_at is null and declined_at is null and expires_at > now();
  get diagnostics n = row_count;
  return n > 0;
end $$;

create function public.consent_invite_decline(p_hash_hex text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.consent_invites
     set declined_at = now(), opened_at = coalesce(opened_at, now())
   where p_hash_hex ~ '^[0-9a-f]{64}$' and token_hash = decode(p_hash_hex, 'hex')
     and used_at is null and revoked_at is null and declined_at is null and expires_at > now();
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Grant: parent has VERIFIED the invited number by OTP (the web backend passes the verified phone).
-- Creates the teen_invite consent with the guardian's account attached (so the parent can
-- withdraw it later), the active parent link, and marks the invite used.
create function public.consent_invite_confirm(
  p_hash_hex       text,
  p_guardian       uuid,
  p_guardian_phone text,
  p_name           text,
  p_relation       text,
  p_policy_version text,
  p_evidence       jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.consent_invites;
  v_id  uuid;
begin
  select * into v_inv from public.consent_invites
   where p_hash_hex ~ '^[0-9a-f]{64}$' and token_hash = decode(p_hash_hex, 'hex') for update;
  if not found or v_inv.used_at is not null or v_inv.revoked_at is not null
     or v_inv.declined_at is not null or v_inv.expires_at <= now() then
    raise exception 'invalid_or_expired_invite' using errcode = 'P0001';
  end if;
  if v_inv.whatsapp_number is distinct from p_guardian_phone then
    raise exception 'phone_mismatch' using errcode = 'P0001';
  end if;
  if p_relation not in ('mother', 'father', 'legal_guardian', 'other') then
    raise exception 'invalid relation' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_guardian and role = 'parent') then
    raise exception 'guardian must be a parent account' using errcode = '42501';
  end if;

  insert into public.consents (
    student_id, route, method, guardian_name, guardian_relation, guardian_user_id, guardian_phone,
    invite_id, policy_version, scope, evidence
  ) values (
    v_inv.student_id, 'teen_invite', 'whatsapp_link', left(p_name, 200), p_relation, p_guardian, v_inv.whatsapp_number,
    v_inv.id, p_policy_version, v_inv.scope, coalesce(p_evidence, '{}'::jsonb)
  ) returning id into v_id;

  update public.consent_invites set used_at = now(), opened_at = coalesce(opened_at, now()) where id = v_inv.id;

  insert into public.parent_links (parent_id, student_id, requested_by, relation, status, verified_at)
  values (p_guardian, v_inv.student_id, v_inv.student_id, p_relation, 'active', now())
  on conflict (parent_id, student_id) do update
     set status = 'active', relation = excluded.relation, verified_at = now(), revoked_at = null;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Route B: parent adds a child. The child auth user already exists (created by the
-- backend with the teen's WhatsApp number, so signing in with that number claims it).
-- The parent's confirmed checkboxes ARE the consent, recorded at creation.
-- ---------------------------------------------------------------------------
create function public.family_add_child(
  p_parent         uuid,
  p_child          uuid,
  p_display_name   text,
  p_dob            date,
  p_school         text,
  p_relation       text,
  p_guardian_name  text,
  p_policy_version text,
  p_evidence       jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id    uuid;
  v_phone text;
begin
  if not exists (select 1 from public.profiles where id = p_parent and role = 'parent') then
    raise exception 'only parents can add a child' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_child and role = 'student' and date_of_birth is null) then
    raise exception 'child must be a fresh student profile' using errcode = '42501';
  end if;
  if p_dob > (current_date - interval '5 years')::date or p_dob <= (current_date - interval '18 years')::date then
    raise exception 'child must be under 18' using errcode = '22023';
  end if;
  if p_relation not in ('mother', 'father', 'legal_guardian', 'other') then
    raise exception 'invalid relation' using errcode = '22023';
  end if;
  if (select count(*) from public.parent_links where parent_id = p_parent and status = 'active') >= 10 then
    raise exception 'too many children on one family account' using errcode = '54000';
  end if;
  select phone into v_phone from public.profiles where id = p_parent;

  update public.profiles
     set display_name = left(p_display_name, 100), date_of_birth = p_dob, school_name = left(p_school, 200)
   where id = p_child;

  insert into public.parent_links (parent_id, student_id, requested_by, relation, status, verified_at)
  values (p_parent, p_child, p_parent, p_relation, 'active', now());

  insert into public.consents (
    student_id, route, method, guardian_name, guardian_relation, guardian_user_id, guardian_phone,
    policy_version, evidence
  ) values (
    p_child, 'parent_account', 'in_app', left(p_guardian_name, 200), p_relation, p_parent, v_phone,
    p_policy_version, coalesce(p_evidence, '{}'::jsonb)
  ) returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Route C: student joins a school with a class code (this IS the student's acceptance
-- of the membership; school staff still need a recorded guardian consent afterwards).
-- ---------------------------------------------------------------------------
create function public.org_join_by_code(p_student uuid, p_code text)
returns table (joined_org uuid, joined_cohort text)
language plpgsql security definer set search_path = '' as $$
declare
  v_code public.org_join_codes;
begin
  if not exists (select 1 from public.profiles where id = p_student and role = 'student') then
    raise exception 'only students can join with a class code' using errcode = '42501';
  end if;
  select c.* into v_code
    from public.org_join_codes c
    join public.organizations o on o.id = c.org_id and o.status = 'active'
   where c.code = upper(btrim(coalesce(p_code, '')))
     and c.revoked_at is null and (c.expires_at is null or c.expires_at > now());
  if not found then
    raise exception 'invalid_class_code' using errcode = 'P0001';
  end if;
  insert into public.org_members (org_id, user_id, role, status, cohort, joined_at)
  values (v_code.org_id, p_student, 'student', 'active', v_code.cohort, now())
  on conflict (org_id, user_id) do update
     set status = 'active', cohort = coalesce(excluded.cohort, public.org_members.cohort),
         joined_at = coalesce(public.org_members.joined_at, now())
   where public.org_members.role = 'student';
  return query select v_code.org_id, v_code.cohort;
end $$;

-- Backend-only: PUBLIC has EXECUTE by default on new functions, close it.
revoke execute on function
  public.consent_invite_create(uuid, text, text, text, interval),
  public.consent_invite_register_send(uuid, int),
  public.consent_invite_lookup(text),
  public.consent_invite_mark_opened(text),
  public.consent_invite_decline(text),
  public.consent_invite_confirm(text, uuid, text, text, text, text, jsonb),
  public.family_add_child(uuid, uuid, text, date, text, text, text, text, jsonb),
  public.org_join_by_code(uuid, text)
from public, anon, authenticated;
grant execute on function
  public.consent_invite_create(uuid, text, text, text, interval),
  public.consent_invite_register_send(uuid, int),
  public.consent_invite_lookup(text),
  public.consent_invite_mark_opened(text),
  public.consent_invite_decline(text),
  public.consent_invite_confirm(text, uuid, text, text, text, text, jsonb),
  public.family_add_child(uuid, uuid, text, date, text, text, text, text, jsonb),
  public.org_join_by_code(uuid, text)
to service_role;

-- A resend issues a fresh link (the raw token is not stored, so the old one cannot be re-sent):
-- swap the hash of a still-live invite. The previous link stops working.
create function public.consent_invite_rotate(p_invite uuid, p_hash_hex text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if p_hash_hex !~ '^[0-9a-f]{64}$' then
    raise exception 'token hash must be 64 hex characters' using errcode = '22023';
  end if;
  update public.consent_invites
     set token_hash = decode(p_hash_hex, 'hex')
   where id = p_invite and used_at is null and revoked_at is null and declined_at is null and expires_at > now();
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke execute on function public.consent_invite_rotate(uuid, text) from public, anon, authenticated;
grant execute on function public.consent_invite_rotate(uuid, text) to service_role;
