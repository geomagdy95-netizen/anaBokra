-- =============================================================================
-- anaBokra MX-04 / 09  (a) consent gate for engagement writes (b) audit minimisation
--
-- (a) Before guardian consent, a minor gets teaser + onboarding only. Writes to
--     favorites, saved_opportunities, roadmaps, milestones, weekly_goals and
--     xp_events are rejected for students under 18 (or with unknown DOB)
--     without an active 'assessment' consent. Deletes stay allowed (a withdrawn
--     minor can still clean up). Enforced by trigger => also binds service_role.
-- (b) audit_log must not copy personal data: consents and profiles are logged
--     as an allow-listed set of ids / method / status / policy_version, plus the
--     NAMES of changed fields. No guardian name/phone/email, no free text.
-- =============================================================================

-- (a) ------------------------------------------------------------------------
-- Non-students are never gated; students are gated while minor & without consent.
create function public.can_use_engagement(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
     where p.id = p_user
       and (p.role <> 'student'
            or not public.is_minor(p.id)
            or public.has_active_consent(p.id, 'assessment'))
  )
$$;

create function public.engagement_consent_gate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_use_engagement(new.user_id) then
    raise exception 'consent_required: guardian consent is needed before this feature is unlocked'
      using errcode = '42501', hint = 'see consents / create_consent_invite()';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['favorites', 'saved_opportunities', 'roadmaps', 'milestones', 'weekly_goals', 'xp_events'] loop
    execute format(
      'create trigger engagement_consent_gate before insert or update on public.%I
         for each row execute function public.engagement_consent_gate()', t);
  end loop;
end $$;

revoke execute on function public.can_use_engagement(uuid), public.engagement_consent_gate() from public, anon, authenticated;
grant  execute on function public.can_use_engagement(uuid), public.engagement_consent_gate() to service_role;
grant  execute on function public.can_use_engagement(uuid) to authenticated;

-- (b) ------------------------------------------------------------------------
-- Keep only the listed keys of a jsonb object (NULL in -> NULL out).
create function public.jsonb_pick(j jsonb, keys text[]) returns jsonb
language sql immutable parallel safe set search_path = '' as $$
  select case when j is null then null
         else coalesce((select jsonb_object_agg(e.k, e.v) from jsonb_each(j) e(k, v) where e.k = any (keys)), '{}'::jsonb) end
$$;
revoke execute on function public.jsonb_pick(jsonb, text[]) from public, anon, authenticated;
grant  execute on function public.jsonb_pick(jsonb, text[]) to service_role;

create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_before  jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_after   jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row     jsonb := coalesce(v_after, v_before);
  v_id      text;
  v_changed text[];
  -- personal-data tables: only these keys are ever copied into the log
  v_allow   text[] := case tg_table_name
    when 'consents' then array['id', 'student_id', 'route', 'method', 'policy_version', 'scope',
                               'granted_at', 'expires_at', 'withdrawn_at', 'withdrawn_by',
                               'guardian_user_id', 'organization_id', 'invite_id']
    when 'profiles' then array['id', 'role']
    else null end;
begin
  if tg_op = 'UPDATE' and (v_before - 'updated_at') = (v_after - 'updated_at') then
    return null;                         -- no-op update
  end if;

  select string_agg(coalesce(v_row ->> a, ''), ':' order by ord)
    into v_id from unnest(tg_argv) with ordinality as t(a, ord);

  if tg_op = 'UPDATE' then
    select array_agg(e.k order by e.k) into v_changed
      from jsonb_each(v_after) e(k, v)
     where e.k <> 'updated_at' and (v_before -> e.k) is distinct from e.v;
  end if;

  v_before := v_before - 'token_hash';
  v_after  := v_after  - 'token_hash';
  if v_allow is not null then
    v_before := public.jsonb_pick(v_before, v_allow);
    v_after  := public.jsonb_pick(v_after,  v_allow);
  end if;

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, before, after, context)
  values (auth.uid(), auth.role(), lower(tg_op), tg_table_name, v_id, v_before, v_after,
          case when v_changed is null then '{}'::jsonb else jsonb_build_object('changed_fields', to_jsonb(v_changed)) end);
  return null;
end $$;

-- profiles: log creation, deletion and changes to the security-relevant columns only
create trigger audit_profiles
  after insert or update of role, date_of_birth or delete on public.profiles
  for each row execute function public.audit_row_change('id');
