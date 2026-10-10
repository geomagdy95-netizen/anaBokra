-- =============================================================================
-- anaBokra MX-04 / 08  GRANTS + FINALIZE
--   * updated_at triggers on every table that has the column
--   * least-privilege table / column / function grants (defence in depth under RLS)
-- Supabase's default privileges grant ALL on new public objects to anon and
-- authenticated; we revoke that and grant back only what the policies need.
-- NEW TABLES MUST ADD THEIR OWN GRANTS (see README "Adding a table").
-- =============================================================================

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public' and c.column_name = 'updated_at' and t.table_type = 'BASE TABLE'
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      r.table_name);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- service_role (backend / Edge Functions) bypasses RLS but still needs privileges
grant all on all tables in schema public to service_role;

-- Public, read-only content
grant select on
  public.clusters, public.careers, public.career_country_data, public.industries, public.career_industries,
  public.institutions, public.programs, public.program_careers, public.opportunities, public.opportunity_careers,
  public.achievements, public.feature_flags, public.app_settings
to anon;

do $$
declare t text;
begin
  -- Full DML for authenticated; RLS decides the rows (owner rows or editor/admin roles).
  foreach t in array array[
    'assessment_sessions', 'responses', 'readiness_checks',
    'favorites', 'saved_opportunities', 'roadmaps', 'milestones', 'weekly_goals', 'notification_prefs',
    'clusters', 'careers', 'career_country_data', 'industries', 'career_industries',
    'institutions', 'programs', 'program_careers', 'opportunities', 'opportunity_careers',
    'achievements', 'review_queue', 'feature_flags', 'app_settings',
    'instrument_versions', 'instrument_keys', 'organizations', 'org_members', 'counselors'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Read-only for end users (written by the backend / triggers)
grant select on public.xp_events, public.user_achievements, public.audit_log, public.subscriptions to authenticated;

-- Special cases
grant select, update                 on public.profiles            to authenticated;   -- no insert (trigger) / delete (cascade)
grant select, insert, update         on public.admin_roles         to authenticated;
grant select, insert, update         on public.parent_links        to authenticated;
grant select, insert                 on public.consents            to authenticated;   -- append-only; withdraw via withdraw_consent()
grant select, delete                 on public.results             to authenticated;   -- scoring service writes
grant select, update                 on public.ai_generations      to authenticated;
grant select, insert, update         on public.bookings            to authenticated;
grant select, insert, update         on public.opportunity_reports to authenticated;
grant select, delete                 on public.notifications       to authenticated;
grant update (read_at)               on public.notifications       to authenticated;

-- consent_invites: the token hash never leaves the database; creation is via create_consent_invite()
grant select (id, student_id, channel, whatsapp_number, guardian_email, guardian_hint, scope, expires_at, used_at, revoked_at, created_at)
  on public.consent_invites to authenticated;
grant update (revoked_at) on public.consent_invites to authenticated;

-- Views
grant select on public.student_summary, public.analytics_results, public.analytics_responses to authenticated;

-- ---------------------------------------------------------------------------
-- Function privileges: default is EXECUTE for PUBLIC; close it, open selectively.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant  execute on all functions in schema public to service_role;

grant execute on function
  public.has_admin_role(public.admin_role),
  public.has_any_admin_role(public.admin_role[]),
  public.can_edit_content(),
  public.is_minor(uuid),
  public.is_linked_parent(uuid),
  public.is_org_staff(uuid),
  public.is_org_admin(uuid),
  public.is_org_member_of(uuid, uuid),
  public.has_active_consent(uuid, text),
  public.can_start_full_assessment(uuid),
  public.can_view_student_summary(uuid),
  public.can_answer_session(uuid),
  public.create_consent_invite(text, text, text, text, text[], interval),
  public.withdraw_consent(uuid, text)
to authenticated;

-- Pure, immutable validators used inside CHECK constraints.
grant execute on function public.is_i18n(jsonb), public.is_i18n_or_null(jsonb) to anon, authenticated;

-- Guardians have no account: redeem is callable anonymously (rate-limit it in the Edge Function).
grant execute on function public.redeem_consent_invite(text, text, text, text, jsonb) to anon, authenticated;
