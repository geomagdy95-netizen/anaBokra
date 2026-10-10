-- =============================================================================
-- anaBokra MX-04 / 07  ROW LEVEL SECURITY
--
-- Model (see supabase/README.md):
--   * deny by default: RLS is enabled on EVERY public table; no policy => no access
--   * students own their rows (user_id = auth.uid())
--   * parents / schools never touch base tables of a child; they read the
--     `student_summary` view, which requires an active link + un-withdrawn consent
--   * back-office via has_admin_role() / has_any_admin_role() (SECURITY DEFINER)
--   * published content is world-readable (anon); writes need content/data roles
--   * server-owned tables (results, xp_events, notifications inserts, ...) have
--     NO end-user write policy: they are written with the service_role key
-- Policies use (select auth.uid()) so Postgres evaluates it once per statement.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extra helpers + guards that only make sense alongside the policies
-- ---------------------------------------------------------------------------
create function public.is_org_member_of(p_org uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.org_members m
     where m.org_id = p_org and m.user_id = p_user and m.status = 'active'
  )
$$;

-- Org admins can only INVITE; the invited user accepts. (Prevents a school admin
-- from enrolling an arbitrary student and then claiming school-route consent.)
create function public.org_members_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null or public.has_admin_role('super_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'invited';
    new.joined_at := null;
    return new;
  end if;
  if new.org_id <> old.org_id or new.user_id <> old.user_id then
    raise exception 'org membership parties are immutable' using errcode = '42501';
  end if;
  if new.role is distinct from old.role and not public.is_org_admin(old.org_id) then
    raise exception 'only organisation admins change roles' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if old.status = 'invited' and new.status = 'active' then
      if auth.uid() <> old.user_id then
        raise exception 'only the invited user can accept membership' using errcode = '42501';
      end if;
      new.joined_at := now();
    elsif new.status = 'removed' then
      null;  -- an org admin or the member themself may end membership
    else
      raise exception 'invalid membership status transition' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger org_members_guard
  before insert or update on public.org_members
  for each row execute function public.org_members_guard();

create function public.organizations_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null or public.has_admin_role('super_admin') then
    return new;
  end if;
  if new.status is distinct from old.status or new.type is distinct from old.type or new.slug is distinct from old.slug then
    raise exception 'organisation status/type/slug are managed by anaBokra staff' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger organizations_guard
  before update on public.organizations
  for each row execute function public.organizations_guard();

-- ---------------------------------------------------------------------------
-- 1. Enable RLS everywhere
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Identity
-- ---------------------------------------------------------------------------
create policy profiles_select_own     on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_select_support on public.profiles for select to authenticated using (public.has_admin_role('support'));
create policy profiles_update_own     on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_update_super   on public.profiles for update to authenticated
  using (public.has_admin_role('super_admin')) with check (public.has_admin_role('super_admin'));
-- no INSERT (handle_new_user trigger) and no DELETE (cascade from auth.users)

create policy admin_roles_select on public.admin_roles for select to authenticated
  using (user_id = (select auth.uid()) or public.has_admin_role('super_admin'));
create policy admin_roles_insert on public.admin_roles for insert to authenticated
  with check (public.has_admin_role('super_admin'));
create policy admin_roles_update on public.admin_roles for update to authenticated
  using (public.has_admin_role('super_admin')) with check (public.has_admin_role('super_admin'));

create policy parent_links_select on public.parent_links for select to authenticated
  using ((select auth.uid()) in (parent_id, student_id) or public.has_admin_role('support'));
create policy parent_links_insert on public.parent_links for insert to authenticated
  with check (requested_by = (select auth.uid()) and (select auth.uid()) in (parent_id, student_id));
create policy parent_links_update on public.parent_links for update to authenticated
  using ((select auth.uid()) in (parent_id, student_id) or public.has_admin_role('support'))
  with check ((select auth.uid()) in (parent_id, student_id) or public.has_admin_role('support'));

create policy organizations_select on public.organizations for select to authenticated
  using (public.is_org_member_of(id, (select auth.uid())) or public.has_admin_role('support'));
create policy organizations_insert on public.organizations for insert to authenticated
  with check (public.has_admin_role('super_admin'));
create policy organizations_update on public.organizations for update to authenticated
  using (public.is_org_admin(id) or public.has_admin_role('super_admin'))
  with check (public.is_org_admin(id) or public.has_admin_role('super_admin'));
create policy organizations_delete on public.organizations for delete to authenticated
  using (public.has_admin_role('super_admin'));

create policy org_members_select on public.org_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_org_admin(org_id) or public.has_admin_role('support'));
create policy org_members_insert on public.org_members for insert to authenticated
  with check (public.is_org_admin(org_id) or public.has_admin_role('super_admin'));
create policy org_members_update on public.org_members for update to authenticated
  using (user_id = (select auth.uid()) or public.is_org_admin(org_id) or public.has_admin_role('super_admin'))
  with check (user_id = (select auth.uid()) or public.is_org_admin(org_id) or public.has_admin_role('super_admin'));
create policy org_members_delete on public.org_members for delete to authenticated
  using (public.is_org_admin(org_id) or public.has_admin_role('super_admin'));

-- ---------------------------------------------------------------------------
-- 3. Consent
-- ---------------------------------------------------------------------------
create policy consents_select on public.consents for select to authenticated
  using (
    student_id = (select auth.uid())
    or guardian_user_id = (select auth.uid())
    or (organization_id is not null and public.is_org_staff(organization_id))
    or public.has_admin_role('support')
  );
-- parent with a PARENT ACCOUNT, actively linked to the child
create policy consents_insert_parent on public.consents for insert to authenticated
  with check (
    route = 'parent_account'
    and guardian_user_id = (select auth.uid())
    and invite_id is null and organization_id is null
    and withdrawn_at is null
    and public.is_linked_parent(student_id)
  );
-- school staff attesting consent for a student who has ACCEPTED membership
create policy consents_insert_school on public.consents for insert to authenticated
  with check (
    route = 'school'
    and withdrawn_at is null
    and public.is_org_staff(organization_id)
    and public.is_org_member_of(organization_id, student_id)
  );
-- teen_invite rows are created ONLY by redeem_consent_invite() (SECURITY DEFINER).
-- No UPDATE / DELETE policies: withdrawal goes through withdraw_consent().

create policy consent_invites_select on public.consent_invites for select to authenticated
  using (student_id = (select auth.uid()));
create policy consent_invites_revoke on public.consent_invites for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
-- INSERT only via create_consent_invite(); token_hash is column-revoked (grants migration)

-- ---------------------------------------------------------------------------
-- 4. Assessment
-- ---------------------------------------------------------------------------
create policy instrument_versions_read on public.instrument_versions for select to authenticated
  using (status = 'active' or public.has_admin_role('assessment_lead'));
create policy instrument_versions_insert on public.instrument_versions for insert to authenticated
  with check (public.has_admin_role('assessment_lead'));
create policy instrument_versions_update on public.instrument_versions for update to authenticated
  using (public.has_admin_role('assessment_lead')) with check (public.has_admin_role('assessment_lead'));
create policy instrument_versions_delete on public.instrument_versions for delete to authenticated
  using (status = 'draft' and public.has_admin_role('assessment_lead'));

create policy instrument_keys_all on public.instrument_keys for all to authenticated
  using (public.has_admin_role('assessment_lead')) with check (public.has_admin_role('assessment_lead'));

create policy sessions_select_own on public.assessment_sessions for select to authenticated
  using (user_id = (select auth.uid()));
create policy sessions_select_support on public.assessment_sessions for select to authenticated
  using (public.has_admin_role('support'));
-- Consent gate: a minor cannot create a FULL session without active consent.
create policy sessions_insert_own on public.assessment_sessions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (kind <> 'full' or public.can_start_full_assessment(user_id))
  );
create policy sessions_update_own on public.assessment_sessions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy sessions_delete_own on public.assessment_sessions for delete to authenticated
  using (user_id = (select auth.uid()));

create policy responses_select_own on public.responses for select to authenticated
  using (user_id = (select auth.uid()));
create policy responses_insert_own on public.responses for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_answer_session(session_id));
create policy responses_update_own on public.responses for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.can_answer_session(session_id));
create policy responses_delete_own on public.responses for delete to authenticated
  using (user_id = (select auth.uid()));

-- results: server-written (scoring service). Owner can read and erase.
create policy results_select_own on public.results for select to authenticated
  using (user_id = (select auth.uid()));
create policy results_delete_own on public.results for delete to authenticated
  using (user_id = (select auth.uid()));

create policy readiness_own on public.readiness_checks for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (session_id is null or exists (
          select 1 from public.assessment_sessions s where s.id = session_id and s.user_id = (select auth.uid())))
  );

-- ---------------------------------------------------------------------------
-- 5. Content: public reads published, editors write
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  -- tables with a lifecycle status
  foreach t in array array['careers', 'career_country_data', 'institutions', 'programs', 'opportunities'] loop
    execute format('create policy %I on public.%I for select to anon, authenticated using (status = ''published'')', t || '_public_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.can_edit_content())', t || '_editor_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_edit_content())', t || '_editor_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_edit_content()) with check (public.can_edit_content())', t || '_editor_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_edit_content())', t || '_editor_delete', t);
  end loop;
  -- reference tables with is_active
  foreach t in array array['clusters', 'industries', 'achievements'] loop
    execute format('create policy %I on public.%I for select to anon, authenticated using (is_active)', t || '_public_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.can_edit_content())', t || '_editor_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_edit_content())', t || '_editor_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_edit_content()) with check (public.can_edit_content())', t || '_editor_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_edit_content())', t || '_editor_delete', t);
  end loop;
end $$;

-- link tables: visible when the parent rows are public; editors see/write all
create policy career_industries_public_read on public.career_industries for select to anon, authenticated
  using (exists (select 1 from public.careers c where c.id = career_id and c.status = 'published'));
create policy program_careers_public_read on public.program_careers for select to anon, authenticated
  using (exists (select 1 from public.careers c where c.id = career_id and c.status = 'published')
     and exists (select 1 from public.programs p where p.id = program_id and p.status = 'published'));
create policy opportunity_careers_public_read on public.opportunity_careers for select to anon, authenticated
  using (exists (select 1 from public.careers c where c.id = career_id and c.status = 'published')
     and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.status = 'published'));

do $$
declare t text;
begin
  foreach t in array array['career_industries', 'program_careers', 'opportunity_careers'] loop
    execute format('create policy %I on public.%I for all to authenticated using (public.can_edit_content()) with check (public.can_edit_content())', t || '_editor_all', t);
  end loop;
end $$;

-- user error reports
create policy opportunity_reports_insert on public.opportunity_reports for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open');
create policy opportunity_reports_select on public.opportunity_reports for select to authenticated
  using (user_id = (select auth.uid()) or public.can_edit_content() or public.has_admin_role('support'));
create policy opportunity_reports_update on public.opportunity_reports for update to authenticated
  using (public.can_edit_content() or public.has_admin_role('support'))
  with check (public.can_edit_content() or public.has_admin_role('support'));

create policy review_queue_all on public.review_queue for all to authenticated
  using (public.can_edit_content()) with check (public.can_edit_content());

-- ---------------------------------------------------------------------------
-- 6. Engagement
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['favorites', 'saved_opportunities', 'roadmaps', 'milestones', 'weekly_goals', 'notification_prefs'] loop
    execute format('create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_own', t);
  end loop;
end $$;

-- server-awarded: owner can read, nobody (but service_role) writes
create policy xp_events_select_own        on public.xp_events         for select to authenticated using (user_id = (select auth.uid()));
create policy user_achievements_select_own on public.user_achievements for select to authenticated using (user_id = (select auth.uid()));

-- notifications: owner reads, marks read (column grant: read_at only), deletes
create policy notifications_select_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete_own on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 7. Platform
-- ---------------------------------------------------------------------------
create policy feature_flags_read  on public.feature_flags for select to anon, authenticated using (true);
create policy feature_flags_write on public.feature_flags for all to authenticated
  using (public.has_admin_role('super_admin')) with check (public.has_admin_role('super_admin'));

create policy app_settings_public_read on public.app_settings for select to anon, authenticated using (is_public);
create policy app_settings_staff_read  on public.app_settings for select to authenticated using (public.has_admin_role('support'));
create policy app_settings_write       on public.app_settings for all to authenticated
  using (public.has_admin_role('super_admin')) with check (public.has_admin_role('super_admin'));

create policy audit_log_select on public.audit_log for select to authenticated using (public.has_admin_role('super_admin'));
-- no INSERT/UPDATE/DELETE policy: triggers + service_role only

create policy ai_generations_select_own   on public.ai_generations for select to authenticated using (user_id = (select auth.uid()));
create policy ai_generations_select_staff on public.ai_generations for select to authenticated
  using (public.has_any_admin_role(array['analyst', 'content_editor', 'assessment_lead']::public.admin_role[]));
create policy ai_generations_resolve_flag on public.ai_generations for update to authenticated
  using (public.has_any_admin_role(array['content_editor', 'assessment_lead']::public.admin_role[]))
  with check (public.has_any_admin_role(array['content_editor', 'assessment_lead']::public.admin_role[]));

-- Phase 2-3 -----------------------------------------------------------------
create policy counselors_select on public.counselors for select to authenticated
  using (status = 'active' or user_id = (select auth.uid()) or public.has_admin_role('support'));
create policy counselors_insert_own on public.counselors for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.profiles p where p.id = user_id and p.role = 'counselor'));
create policy counselors_update_own on public.counselors for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy counselors_staff on public.counselors for all to authenticated
  using (public.has_admin_role('support')) with check (public.has_admin_role('support'));

create policy bookings_select on public.bookings for select to authenticated
  using ((select auth.uid()) in (student_id, counselor_id) or public.has_admin_role('support'));
create policy bookings_insert on public.bookings for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and (not public.is_minor(student_id) or public.has_active_consent(student_id, 'counseling'))
    and exists (select 1 from public.counselors c where c.user_id = counselor_id and c.status = 'active')
  );
create policy bookings_update on public.bookings for update to authenticated
  using ((select auth.uid()) in (student_id, counselor_id) or public.has_admin_role('support'))
  with check ((select auth.uid()) in (student_id, counselor_id) or public.has_admin_role('support'));

create policy subscriptions_select on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid())
         or (organization_id is not null and public.is_org_admin(organization_id))
         or public.has_admin_role('support'));
-- writes: payment webhooks (service_role) only

-- ---------------------------------------------------------------------------
-- 8. Parent / school SUMMARY view (never raw responses) + pseudonymous analytics
--    Views run with the owner's rights (security_invoker = false) and apply the
--    visibility predicate themselves; security_barrier stops predicate leakage.
-- ---------------------------------------------------------------------------
create view public.student_summary with (security_barrier = true) as
select
  p.id           as student_id,
  p.display_name,
  p.grade,
  p.curriculum,
  p.track,
  p.locale,
  lr.created_at  as latest_result_at,
  lr.assessment_version,
  lr.summary,                                                       -- parent-safe digest only
  (select count(*) from public.assessment_sessions s
     where s.user_id = p.id and s.kind = 'full' and s.status = 'completed')::int as full_assessments_completed,
  (select max(s.last_active_at) from public.assessment_sessions s where s.user_id = p.id) as last_active_at,
  (select count(*) from public.favorites f where f.user_id = p.id)::int                   as favorites_count,
  (select count(*) from public.milestones m where m.user_id = p.id and m.status = 'done')::int as milestones_done,
  (select count(*) from public.milestones m where m.user_id = p.id)::int                  as milestones_total,
  coalesce((select sum(x.points) from public.xp_events x where x.user_id = p.id), 0)::int as xp_total
from public.profiles p
left join lateral (
  select r.created_at, r.assessment_version, r.summary
    from public.results r where r.user_id = p.id
   order by r.created_at desc limit 1
) lr on true
where p.role = 'student'
  and public.can_view_student_summary(p.id);

comment on view public.student_summary is
  'Summary-only projection for the student, an actively linked parent (consent active), school staff (school consent active) and support. Contains no raw responses, scores or quality flags.';

-- Pseudonymous research views: no user id, no name; only consented-for-data_processing students.
create view public.analytics_results with (security_barrier = true) as
select
  r.id as result_id, r.created_at, r.assessment_version, r.engine_version, r.norms_version,
  r.scores, r.coverage, r.quality, s.kind as session_kind, s.locale,
  p.gender, p.grade, p.curriculum, p.track
from public.results r
join public.assessment_sessions s on s.id = r.session_id
join public.profiles p on p.id = r.user_id
where public.has_any_admin_role(array['analyst', 'assessment_lead']::public.admin_role[])
  and public.has_active_consent(r.user_id, 'data_processing');

create view public.analytics_responses with (security_barrier = true) as
select
  rs.session_id, rs.instrument_id, rs.item_id, rs.value, rs.ms, rs.answered_at, s.kind as session_kind
from public.responses rs
join public.assessment_sessions s on s.id = rs.session_id
where public.has_any_admin_role(array['analyst', 'assessment_lead']::public.admin_role[])
  and public.has_active_consent(rs.user_id, 'data_processing');

-- ---------------------------------------------------------------------------
-- 9. Guard rail: fail the migration if any public table lacks RLS or policies
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select c.relname,
           c.relrowsecurity,
           (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as n_policies
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
  loop
    if not r.relrowsecurity then
      raise exception 'RLS is not enabled on public.%', r.relname;
    end if;
    if r.n_policies = 0 then
      raise exception 'public.% has RLS enabled but no policies (add one, or document why it is service-role only)', r.relname;
    end if;
  end loop;
end $$;
