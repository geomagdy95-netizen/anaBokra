-- =============================================================================
-- anaBokra MX-04 / 02  CONSENT
--   consent_invites (token hash, expiry, WhatsApp number)
--   consents        (ONE table for the 3 routes: teen_invite | parent_account | school)
-- Consent rows are append-only legal records: only the withdrawal columns may
-- change, and a withdrawal is final (re-consent = a new row).
-- =============================================================================

create table public.consent_invites (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles (id) on delete cascade,
  channel        text not null check (channel in ('whatsapp', 'email')),
  whatsapp_number text check (whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),
  guardian_email text check (guardian_email ~ '^[^@\s]+@[^@\s]+$'),
  guardian_hint  text check (char_length(guardian_hint) <= 100),   -- e.g. "Mama"; shown to the teen only
  -- sha-256 of the raw token. The raw token is returned ONCE by create_consent_invite()
  -- and never stored.
  token_hash     bytea not null unique check (octet_length(token_hash) = 32),
  scope          text[] not null default array['assessment', 'data_processing'],
  expires_at     timestamptz not null,
  used_at        timestamptz,
  revoked_at     timestamptz,
  created_at     timestamptz not null default now(),
  check (channel <> 'whatsapp' or whatsapp_number is not null),
  check (channel <> 'email' or guardian_email is not null),
  check (expires_at > created_at)
);
create index consent_invites_student_idx on public.consent_invites (student_id, created_at desc);

create table public.consents (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.profiles (id) on delete cascade,
  route            public.consent_route not null,
  method           public.consent_method not null,
  -- guardian identity (a school representative for route = school)
  guardian_name    text not null check (char_length(guardian_name) between 1 and 200),
  guardian_relation text not null check (guardian_relation in ('mother', 'father', 'legal_guardian', 'other', 'school')),
  guardian_user_id uuid references public.profiles (id) on delete set null,   -- parent_account route
  guardian_phone   text check (guardian_phone ~ '^\+[1-9][0-9]{7,14}$'),
  guardian_email   text,
  organization_id  uuid references public.organizations (id) on delete set null, -- school route
  invite_id        uuid references public.consent_invites (id) on delete set null, -- teen_invite route
  policy_version   text not null check (char_length(policy_version) between 1 and 40),
  scope            text[] not null default array['assessment', 'data_processing']
                   check (scope <> '{}' and scope <@ array['assessment', 'data_processing', 'counseling', 'research']),
  granted_at       timestamptz not null default now(),
  expires_at       timestamptz,
  withdrawn_at     timestamptz,
  withdrawn_by     uuid references public.profiles (id) on delete set null,
  withdrawn_reason text check (char_length(withdrawn_reason) <= 500),
  evidence         jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'), -- ip hash, UA, locale, text shown
  created_at       timestamptz not null default now(),
  check (withdrawn_at is null or withdrawn_at >= granted_at),
  check (expires_at is null or expires_at > granted_at),
  check (route <> 'parent_account' or guardian_user_id is not null),
  check (route <> 'school'         or organization_id is not null),
  check (route <> 'teen_invite'    or invite_id is not null),
  -- route <-> method coherence
  check (
    (route = 'teen_invite'   and method in ('whatsapp_link', 'email_link')) or
    (route = 'parent_account' and method = 'in_app') or
    (route = 'school'        and method in ('school_attestation', 'paper_form'))
  )
);
create index consents_student_active_idx on public.consents (student_id) where withdrawn_at is null;
create index consents_guardian_idx       on public.consents (guardian_user_id) where guardian_user_id is not null;
create index consents_org_idx            on public.consents (organization_id) where organization_id is not null;

-- ---------------------------------------------------------------------------
-- Immutability: only withdrawn_* may change, and only once.
-- ---------------------------------------------------------------------------
create function public.consents_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'withdrawn_at' - 'withdrawn_by' - 'withdrawn_reason')
     is distinct from
     (to_jsonb(old) - 'withdrawn_at' - 'withdrawn_by' - 'withdrawn_reason') then
    raise exception 'consents are append-only; only withdrawal fields may change' using errcode = '42501';
  end if;
  if old.withdrawn_at is not null and new.withdrawn_at is distinct from old.withdrawn_at then
    raise exception 'withdrawal is final; record a new consent instead' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger consents_immutable
  before update on public.consents
  for each row execute function public.consents_immutable();

-- ---------------------------------------------------------------------------
-- Consent queries
-- ---------------------------------------------------------------------------

-- Does the student have a granted, un-withdrawn, unexpired consent covering p_scope?
create function public.has_active_consent(p_student uuid, p_scope text default 'assessment') returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.consents c
     where c.student_id = p_student
       and c.withdrawn_at is null
       and c.granted_at <= now()
       and (c.expires_at is null or c.expires_at > now())
       and p_scope = any (c.scope)
  )
$$;

-- THE gate for full assessment sessions: students 18+ may start freely; minors
-- (or unknown DOB) need an active 'assessment' consent. Non-students never.
create function public.can_start_full_assessment(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
     where p.id = p_user
       and p.role = 'student'
       and (not public.is_minor(p.id) or public.has_active_consent(p.id, 'assessment'))
  )
$$;

-- TODO(legal): once lawyer review lands, a parent's summary of a student who is
-- 18+ must require the ADULT student's own opt-in (consent). Until then any
-- active consent row suffices, regardless of age.
-- Who may see a student's SUMMARY (never raw responses):
--   the student; an actively linked parent while consent is active; school staff
--   while a *school-route* consent for that org is active; support.
create function public.can_view_student_summary(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select
    auth.uid() = p_student
    or public.has_admin_role('support')
    or (public.is_linked_parent(p_student) and public.has_active_consent(p_student, 'assessment'))
    or exists (
      select 1
        from public.consents c
        join public.org_members sm on sm.org_id = c.organization_id and sm.user_id = p_student and sm.status = 'active'
       where c.student_id = p_student
         and c.route = 'school'
         and c.withdrawn_at is null
         and (c.expires_at is null or c.expires_at > now())
         and public.is_org_staff(c.organization_id)
    )
$$;

-- ---------------------------------------------------------------------------
-- Teen-initiated invite flow (route = teen_invite)
--   1. student calls create_consent_invite()  -> gets a raw token ONCE
--   2. the app sends https://anabokra.app/consent/<token> via WhatsApp / email
--   3. guardian (no account needed) -> Edge Function -> redeem_consent_invite()
-- ---------------------------------------------------------------------------
create function public.create_consent_invite(
  p_channel        text,
  p_whatsapp       text default null,
  p_email          text default null,
  p_guardian_hint  text default null,
  p_scope          text[] default array['assessment', 'data_processing'],
  p_ttl            interval default interval '7 days'
) returns table (invite_id uuid, invite_token text, invite_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_token text;
  v_id    uuid;
  v_exp   timestamptz;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and role = 'student') then
    raise exception 'only students can invite a guardian' using errcode = '42501';
  end if;
  if p_ttl <= interval '0' or p_ttl > interval '30 days' then
    raise exception 'ttl must be within (0, 30 days]' using errcode = '22023';
  end if;
  if (select count(*) from public.consent_invites i
       where i.student_id = v_uid and i.used_at is null and i.revoked_at is null and i.expires_at > now()) >= 5 then
    raise exception 'too many active invites' using errcode = '54000';
  end if;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');   -- 244 bits CSPRNG
  v_exp   := now() + p_ttl;

  insert into public.consent_invites (student_id, channel, whatsapp_number, guardian_email, guardian_hint, scope, token_hash, expires_at)
  values (v_uid, p_channel, p_whatsapp, p_email, p_guardian_hint, p_scope, sha256(convert_to(v_token, 'UTF8')), v_exp)
  returning id into v_id;

  return query select v_id, v_token, v_exp;
end $$;

-- Redeem is callable anonymously (the guardian has no account). Put it behind an
-- Edge Function with rate limiting. All failure modes return the same error.
create function public.redeem_consent_invite(
  p_token          text,
  p_guardian_name  text,
  p_relation       text,
  p_policy_version text,
  p_evidence       jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.consent_invites;
  v_id  uuid;
begin
  select * into v_inv
    from public.consent_invites i
   where i.token_hash = sha256(convert_to(coalesce(p_token, ''), 'UTF8'))
   for update;

  if not found or v_inv.used_at is not null or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception 'invalid_or_expired_invite' using errcode = 'P0001';
  end if;
  if p_relation not in ('mother', 'father', 'legal_guardian', 'other') then
    raise exception 'invalid relation' using errcode = '22023';
  end if;

  insert into public.consents (
    student_id, route, method, guardian_name, guardian_relation, guardian_phone, guardian_email,
    invite_id, policy_version, scope, evidence
  ) values (
    v_inv.student_id, 'teen_invite',
    case v_inv.channel when 'whatsapp' then 'whatsapp_link'::public.consent_method else 'email_link'::public.consent_method end,
    p_guardian_name, p_relation, v_inv.whatsapp_number, v_inv.guardian_email,
    v_inv.id, p_policy_version, v_inv.scope, coalesce(p_evidence, '{}'::jsonb)
  ) returning id into v_id;

  update public.consent_invites set used_at = now() where id = v_inv.id;
  return v_id;
end $$;

-- Withdraw: the guardian who granted it (parent account), the student, or support.
-- (Guardians without an account withdraw through support / the student.)
create function public.withdraw_consent(p_consent uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.consents;
begin
  select * into v_c from public.consents where id = p_consent for update;
  if not found then
    raise exception 'consent not found' using errcode = 'P0002';
  end if;
  if auth.uid() is null
     or not (auth.uid() = v_c.student_id or auth.uid() = v_c.guardian_user_id
             or public.has_admin_role('support')
             or (v_c.organization_id is not null and public.is_org_admin(v_c.organization_id))) then
    raise exception 'not allowed to withdraw this consent' using errcode = '42501';
  end if;
  if v_c.withdrawn_at is not null then
    return;   -- idempotent
  end if;
  update public.consents
     set withdrawn_at = now(), withdrawn_by = auth.uid(), withdrawn_reason = left(p_reason, 500)
   where id = p_consent;
end $$;
