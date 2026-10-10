-- =============================================================================
-- anaBokra MX-04: RLS / consent-gate / guard tests (plain SQL assertions, no pgTAP)
--
-- Run AFTER all migrations (and optionally seed.sql), as a superuser:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
-- Everything happens in one transaction that is ROLLED BACK, so it is safe on a
-- dev database. Each assertion prints "ok - ..." (NOTICE); the first failure
-- aborts with "FAIL: ...". On vanilla Postgres load tests/support/local_shim.sql
-- before the migrations; on Supabase no shim is needed.
-- =============================================================================
\set QUIET on
begin;

-- ---------------------------------------------------------------------------
-- Tiny assertion harness (schema `tests`, dropped by the rollback)
-- ---------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to public;
create table tests.ctx (k text primary key, v text);
grant all on tests.ctx to public;

create function tests.pass(p_desc text) returns void language plpgsql as $$
begin raise notice 'ok - %', p_desc; end $$;

create function tests.ok(p_cond boolean, p_desc text) returns void language plpgsql as $$
begin
  if p_cond is true then raise notice 'ok - %', p_desc;
  else raise exception 'FAIL: %', p_desc; end if;
end $$;

create function tests.eq(p_actual bigint, p_expected bigint, p_desc text) returns void language plpgsql as $$
begin
  if p_actual is not distinct from p_expected then raise notice 'ok - %', p_desc;
  else raise exception 'FAIL: % (expected %, got %)', p_desc, p_expected, p_actual; end if;
end $$;

-- statement must raise the given SQLSTATE
create function tests.throws(p_sql text, p_state text, p_desc text) returns void language plpgsql as $$
begin
  execute p_sql;
exception when others then
  if sqlstate = p_state then raise notice 'ok - %', p_desc; return;
  else raise exception 'FAIL: % (expected %, got % %)', p_desc, p_state, sqlstate, sqlerrm; end if;
end $$;

-- statement must succeed
create function tests.lives(p_sql text, p_desc text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise notice 'ok - %', p_desc;
exception when others then
  raise exception 'FAIL: % (got % %)', p_desc, sqlstate, sqlerrm;
end $$;

-- statement must succeed and touch exactly p_rows rows
create function tests.affects(p_sql text, p_rows bigint, p_desc text) returns void language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  if n = p_rows then raise notice 'ok - %', p_desc;
  else raise exception 'FAIL: % (expected % rows, got %)', p_desc, p_rows, n; end if;
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise exception 'FAIL: % (raised % %)', p_desc, sqlstate, sqlerrm;
end $$;

create function tests.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function tests.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures (as superuser)
-- ---------------------------------------------------------------------------
-- 01 minor student   02 adult student   03 other minor student
-- 04 parent          05 unrelated parent
-- 06 content_editor  07 data_curator    08 assessment_lead  09 analyst  10 support  11 super_admin
-- 12 school_admin (org admin)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'minor@t.test',  '{"role":"student"}'),
  ('00000000-0000-0000-0000-000000000002', 'adult@t.test',  '{"role":"student"}'),
  ('00000000-0000-0000-0000-000000000003', 'minor2@t.test', '{"role":"student"}'),
  ('00000000-0000-0000-0000-000000000004', 'parent@t.test', '{"role":"parent"}'),
  ('00000000-0000-0000-0000-000000000005', 'parent2@t.test','{"role":"parent"}'),
  ('00000000-0000-0000-0000-000000000006', 'editor@t.test', '{"role":"admin"}'),   -- signup cannot self-assign admin
  ('00000000-0000-0000-0000-000000000007', 'curator@t.test','{}'),
  ('00000000-0000-0000-0000-000000000008', 'lead@t.test',   '{}'),
  ('00000000-0000-0000-0000-000000000009', 'analyst@t.test','{}'),
  ('00000000-0000-0000-0000-000000000010', 'support@t.test','{}'),
  ('00000000-0000-0000-0000-000000000011', 'super@t.test',  '{}'),
  ('00000000-0000-0000-0000-000000000012', 'school@t.test', '{}');

\o /dev/null
select tests.ok((select role = 'student' from public.profiles where id = '00000000-0000-0000-0000-000000000006'),
                'signup metadata cannot self-assign role=admin');

update public.profiles set date_of_birth = current_date - interval '15 years'
 where id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003');
update public.profiles set date_of_birth = current_date - interval '20 years'
 where id = '00000000-0000-0000-0000-000000000002';
update public.profiles set role = 'admin'
 where id in ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000008',
              '00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000011');
update public.profiles set role = 'school_admin' where id = '00000000-0000-0000-0000-000000000012';

insert into public.admin_roles (user_id, role) values
  ('00000000-0000-0000-0000-000000000006', 'content_editor'),
  ('00000000-0000-0000-0000-000000000007', 'data_curator'),
  ('00000000-0000-0000-0000-000000000008', 'assessment_lead'),
  ('00000000-0000-0000-0000-000000000009', 'analyst'),
  ('00000000-0000-0000-0000-000000000010', 'support'),
  ('00000000-0000-0000-0000-000000000011', 'super_admin');

insert into public.clusters (id, name) values ('zz_cluster', '{"en":"ZZ","ar":"زد"}');
insert into public.careers (id, cluster_id, name, traits, status, last_reviewed_at) values
  ('zz_pub',   'zz_cluster', '{"en":"Pub","ar":"عام"}',   '{"riasec":{},"personality":{},"values":{},"abilities":{}}', 'published', now()),
  ('zz_draft', 'zz_cluster', '{"en":"Draft","ar":"مسودة"}', null, 'draft', null);
insert into public.opportunities (id, type, title, source_url, verified_at, verified_by, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'course', '{"en":"Pub course","ar":"كورس"}', 'https://example.org/c', now(),
   '00000000-0000-0000-0000-000000000007', 'published');

insert into public.organizations (id, name, status) values
  ('00000000-0000-0000-0000-0000000000b1', '{"en":"Test School","ar":"مدرسة"}', 'active');
insert into public.org_members (org_id, user_id, role, status, joined_at) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000012', 'admin', 'active', now());

insert into public.notifications (id, user_id, kind, title)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', 'welcome', '{"en":"Hi","ar":"أهلا"}');

-- =============================================================================
-- A. Structural guarantees
-- =============================================================================
select tests.eq((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 0,
                'RLS is enabled on every public table');
select tests.eq((select count(*) from pg_tables t where t.schemaname = 'public'
                  and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)), 0,
                'every public table has at least one policy');
select tests.eq((select count(*) from information_schema.columns
                  where table_schema = 'public' and table_name = 'student_summary'
                    and column_name in ('scores', 'matches', 'quality', 'responses', 'value', 'ms', 'date_of_birth', 'phone')), 0,
                'student_summary exposes no raw scores / responses / PII');

-- =============================================================================
-- B. Anonymous
-- =============================================================================
select tests.anon();
select tests.eq((select count(*) from public.careers where id like 'zz\_%'), 1, 'anon sees only the published career');
select tests.eq((select count(*) from public.clusters where id = 'zz_cluster'), 1, 'anon can read clusters');
select tests.eq((select count(*) from public.opportunities where id = '00000000-0000-0000-0000-0000000000a1'), 1, 'anon sees published opportunity');
select tests.throws('select * from public.profiles', '42501', 'anon cannot read profiles');
select tests.throws('select * from public.responses', '42501', 'anon cannot read responses');
select tests.throws('select * from public.audit_log', '42501', 'anon cannot read audit_log');
select tests.throws($$insert into public.careers (id, cluster_id, name) values ('zz_anon', 'zz_cluster', '{"en":"x","ar":"x"}')$$,
                    '42501', 'anon cannot write content');
select tests.throws('select * from public.student_summary', '42501', 'anon cannot read student_summary');
reset role;

-- =============================================================================
-- C. Students own their rows; no privilege escalation
-- =============================================================================
select tests.login('00000000-0000-0000-0000-000000000001');
select tests.eq((select count(*) from public.profiles), 1, 'student sees only their own profile');
select tests.eq((select count(*) from public.careers where id like 'zz\_%'), 1, 'student sees published careers only');
select tests.throws($$update public.profiles set role = 'admin' where id = auth.uid()$$, '42501', 'student cannot change own role');
select tests.throws($$update public.profiles set date_of_birth = '2000-01-01' where id = auth.uid()$$, '42501', 'student cannot rewrite date_of_birth to dodge the consent gate');
select tests.affects($$update public.profiles set display_name = 'Mina' where id = auth.uid()$$, 1, 'student can edit own display_name');
select tests.affects($$update public.profiles set display_name = 'hax' where id <> auth.uid()$$, 0, 'student cannot edit other profiles');
select tests.throws($$insert into public.admin_roles (user_id, role) values (auth.uid(), 'super_admin')$$, '23514', 'student cannot grant self an admin role (trigger rejects non-admin profiles before RLS)');
select tests.throws($$insert into public.careers (id, cluster_id, name) values ('zz_s', 'zz_cluster', '{"en":"x","ar":"x"}')$$, '42501', 'student cannot write content');
select tests.affects($$update public.careers set status = 'archived' where id = 'zz_pub'$$, 0, 'student cannot update content');
select tests.eq((select count(*) from public.admin_roles), 0, 'student sees no admin_roles');
select tests.throws($$insert into public.xp_events (user_id, event_type, points) values (auth.uid(), 'cheat', 9999)$$, '42501', 'student cannot self-award XP');
select tests.throws($$insert into public.results (user_id, session_id, assessment_version, scores) values (auth.uid(), gen_random_uuid(), 'x', '{}')$$, '42501', 'student cannot write results');
select tests.throws($$insert into public.favorites (user_id, career_id) values (auth.uid(), 'zz_pub')$$, '42501',
                    'minor WITHOUT consent cannot favorite (teaser + onboarding only)');
select tests.throws($$insert into public.saved_opportunities (user_id, item_kind, item_id) values (auth.uid(), 'program', 'cairo-university-medicine')$$, '42501',
                    'minor WITHOUT consent cannot save opportunities');
select tests.throws($$insert into public.roadmaps (user_id, title) values (auth.uid(), 'plan')$$, '42501', 'minor WITHOUT consent cannot create a roadmap');
select tests.throws($$insert into public.weekly_goals (user_id, week_start, goal_type, target) values (auth.uid(), current_date, 'explore', 3)$$, '42501',
                    'minor WITHOUT consent cannot set weekly goals');
select tests.lives($$insert into public.notification_prefs (user_id) values (auth.uid())$$, 'onboarding still works: minor can set notification prefs');
select tests.throws($$insert into public.favorites (user_id, career_id) values ('00000000-0000-0000-0000-000000000003', 'zz_pub')$$, '42501', 'student cannot favorite on behalf of another');
select tests.lives($$update public.profiles set grade = 11, track = 'science' where id = auth.uid()$$, 'onboarding still works: minor can fill profile context');
select tests.affects($$update public.notifications set read_at = now() where id = '00000000-0000-0000-0000-0000000000c1'$$, 1, 'student can mark a notification read');
select tests.throws($$update public.notifications set kind = 'x' where id = '00000000-0000-0000-0000-0000000000c1'$$, '42501', 'student can change only notifications.read_at');
reset role;

select tests.login('00000000-0000-0000-0000-000000000003');
select tests.eq((select count(*) from public.favorites), 0, 'other student cannot see favorites of student 1');
select tests.eq((select count(*) from public.notifications), 0, 'other student cannot see notifications of student 1');
reset role;

select tests.login('00000000-0000-0000-0000-000000000002');
select tests.lives($$insert into public.favorites (user_id, career_id) values (auth.uid(), 'zz_pub')$$, 'adult student (20y) can favorite without consent');
reset role;
select tests.throws($$insert into public.xp_events (user_id, event_type, points) values ('00000000-0000-0000-0000-000000000001', 'station_completed', 50)$$, '42501',
                    'XP cannot be awarded to a minor without consent (even by the backend)');
select tests.lives($$insert into public.xp_events (user_id, event_type, points) values ('00000000-0000-0000-0000-000000000002', 'station_completed', 50)$$,
                   'XP can be awarded to an adult');

-- =============================================================================
-- D. Consent gate for minors
-- =============================================================================
select tests.login('00000000-0000-0000-0000-000000000001');
select tests.throws($$insert into public.assessment_sessions (user_id, kind) values (auth.uid(), 'full')$$, '42501',
                    'minor WITHOUT consent cannot start a full session');
select tests.lives($$insert into public.assessment_sessions (user_id, kind) values (auth.uid(), 'quick')$$,
                   'minor can start a quick (taster) session without consent');
reset role;

select tests.login('00000000-0000-0000-0000-000000000002');
select tests.lives($$insert into public.assessment_sessions (user_id, kind) values (auth.uid(), 'full')$$,
                   'adult (20y) can start a full session without consent');
reset role;

-- guard also protects against service-role / trigger-level bypass
select tests.throws($$insert into public.assessment_sessions (user_id, kind) values ('00000000-0000-0000-0000-000000000001', 'full')$$,
                    '42501', 'consent gate is enforced by trigger even for privileged writers');

-- teen invite flow
select tests.login('00000000-0000-0000-0000-000000000001');
insert into tests.ctx select 'tok', invite_token from public.create_consent_invite('whatsapp', '+201001234567', null, 'Mama');
select tests.throws('select token_hash from public.consent_invites', '42501', 'token hash is not readable by the student');
select tests.eq((select count(*) from public.consent_invites), 1, 'student sees own invite (without hash)');
select tests.throws($$insert into public.consent_invites (student_id, channel, whatsapp_number, token_hash, expires_at)
                      values (auth.uid(), 'whatsapp', '+201001234567', sha256('x'), now() + interval '1 day')$$,
                    '42501', 'invites can only be created through create_consent_invite()');
select tests.throws($$insert into public.consents (student_id, route, method, guardian_name, guardian_relation, policy_version)
                      values (auth.uid(), 'teen_invite', 'whatsapp_link', 'Me', 'mother', 'v1')$$,
                    '42501', 'a student cannot forge their own consent');
reset role;

-- an expired invite (created in the past)
insert into public.consent_invites (student_id, channel, whatsapp_number, token_hash, created_at, expires_at)
values ('00000000-0000-0000-0000-000000000001', 'whatsapp', '+201001234567', sha256(convert_to('expired-token', 'UTF8')),
        now() - interval '2 days', now() - interval '1 day');

select tests.anon();
select tests.throws($$select public.redeem_consent_invite((select v from tests.ctx where k = 'tok'), 'Mama', 'mother', 'v1')$$,
                    '42501', 'anon cannot redeem an invite directly (parent must verify by OTP via the backend)');
select tests.throws('select * from public.consents', '42501', 'anon cannot read consents');
reset role;
select tests.login('00000000-0000-0000-0000-000000000001');
select tests.throws($$select public.redeem_consent_invite((select v from tests.ctx where k = 'tok'), 'Mama', 'mother', 'v1')$$,
                    '42501', 'a student cannot redeem their own invite');
reset role;

-- the backend (service role) is the only caller now; tests.service() is defined further down
select set_config('request.jwt.claims', '{"role":"service_role"}', true), set_config('role', 'service_role', true);
select tests.throws($$select public.redeem_consent_invite('not-a-token', 'Mama', 'mother', 'v1')$$, 'P0001', 'bad token is rejected');
select tests.throws($$select public.redeem_consent_invite('expired-token', 'Mama', 'mother', 'v1')$$, 'P0001', 'expired token is rejected');
insert into tests.ctx select 'consent', public.redeem_consent_invite((select v from tests.ctx where k = 'tok'), 'Mama', 'mother', 'v1', '{"ua":"test"}');
select tests.throws($$select public.redeem_consent_invite((select v from tests.ctx where k = 'tok'), 'Mama', 'mother', 'v1')$$,
                    'P0001', 'a token cannot be redeemed twice');
reset role;

select tests.ok((select route = 'teen_invite' and method = 'whatsapp_link' and guardian_phone = '+201001234567' and withdrawn_at is null
                   from public.consents where id = (select v::uuid from tests.ctx where k = 'consent')),
                'redeeming records route, method, guardian phone and a live consent');
select tests.throws($$update public.consents set guardian_name = 'Mallory' where id = (select v::uuid from tests.ctx where k = 'consent')$$,
                    '42501', 'consents are immutable (even for superuser): only withdrawal fields change');

select tests.login('00000000-0000-0000-0000-000000000001');
select tests.lives($$insert into public.assessment_sessions (id, user_id, kind) values ('00000000-0000-0000-0000-0000000000d1', auth.uid(), 'full')$$,
                   'minor WITH active consent can start a full session');
select tests.lives($$insert into public.favorites (user_id, career_id) values (auth.uid(), 'zz_pub')$$, 'minor WITH consent can favorite');
select tests.lives($$insert into public.roadmaps (id, user_id, title) values ('00000000-0000-0000-0000-0000000000e1', auth.uid(), 'plan')$$, 'minor WITH consent can create a roadmap');
select tests.lives($$insert into public.milestones (roadmap_id, user_id, title) values ('00000000-0000-0000-0000-0000000000e1', auth.uid(), 'step 1')$$, 'minor WITH consent can add a milestone');
select tests.lives($$insert into public.weekly_goals (user_id, week_start, goal_type, target) values (auth.uid(), current_date, 'explore', 3)$$, 'minor WITH consent can set a weekly goal');
select tests.throws($$insert into public.assessment_sessions (user_id, kind) values (auth.uid(), 'full')$$, '23505', 'only one open full session per student (resume instead)');
select tests.lives($$insert into public.responses (session_id, user_id, instrument_id, item_id, value, ms)
                     values ('00000000-0000-0000-0000-0000000000d1', auth.uid(), 'interests', 'ri_001', 4, 2300)$$,
                   'student saves a response');
select tests.lives($$insert into public.responses (session_id, user_id, instrument_id, item_id, value, ms)
                     values ('00000000-0000-0000-0000-0000000000d1', auth.uid(), 'interests', 'ri_001', 5, 1800)
                     on conflict (session_id, item_id) do update set value = excluded.value, ms = excluded.ms$$,
                   'responses upsert (save/resume) works');
reset role;

select tests.login('00000000-0000-0000-0000-000000000003');
select tests.throws($$insert into public.responses (session_id, user_id, instrument_id, item_id, value)
                     values ('00000000-0000-0000-0000-0000000000d1', auth.uid(), 'interests', 'ri_002', 3)$$,
                    '42501', 'another student cannot write into my session');
select tests.throws($$insert into public.responses (session_id, user_id, instrument_id, item_id, value)
                     values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000001', 'interests', 'ri_002', 3)$$,
                    '42501', 'another student cannot impersonate user_id on responses');
select tests.eq((select count(*) from public.responses), 0, 'another student cannot read my responses');
reset role;

-- scoring service writes the result (service-role path = superuser here)
insert into public.results (user_id, session_id, assessment_version, scores, summary)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1', '2026.1',
        '{"interests":{"R":0.5}}', '{"holland":"ISR","topCareers":["zz_pub"]}');

-- completed session no longer accepts answers
update public.assessment_sessions set status = 'completed', completed_at = now() where id = '00000000-0000-0000-0000-0000000000d1';
select tests.login('00000000-0000-0000-0000-000000000001');
select tests.throws($$insert into public.responses (session_id, user_id, instrument_id, item_id, value)
                     values ('00000000-0000-0000-0000-0000000000d1', auth.uid(), 'interests', 'ri_003', 3)$$,
                    '42501', 'no answers into a completed session');
select tests.eq((select count(*) from public.results), 1, 'student reads own result');
reset role;
update public.assessment_sessions set status = 'in_progress', completed_at = null where id = '00000000-0000-0000-0000-0000000000d1';

-- =============================================================================
-- E. Parents: SUMMARY only, active link + active consent
-- =============================================================================
select tests.login('00000000-0000-0000-0000-000000000004');
select tests.eq((select count(*) from public.student_summary), 0, 'parent without link sees no summary');
select tests.lives($$insert into public.parent_links (parent_id, student_id, requested_by, status)
                     values (auth.uid(), '00000000-0000-0000-0000-000000000001', auth.uid(), 'active')$$,
                   'parent can request a link (status forced to pending)');
select tests.eq((select count(*) from public.student_summary), 0, 'pending link shows nothing');
select tests.throws($$update public.parent_links set status = 'active' where parent_id = auth.uid()$$, '42501', 'requester cannot accept their own link');
reset role;
select tests.ok((select status = 'pending' from public.parent_links where parent_id = '00000000-0000-0000-0000-000000000004'), 'link was stored as pending');

select tests.login('00000000-0000-0000-0000-000000000001');
select tests.affects($$update public.parent_links set status = 'active' where student_id = auth.uid()$$, 1, 'the student accepts the parent link');
reset role;

select tests.login('00000000-0000-0000-0000-000000000004');
select tests.eq((select count(*) from public.student_summary), 1, 'linked parent + active consent sees the child summary');
select tests.ok((select summary ->> 'holland' = 'ISR' from public.student_summary), 'summary carries the parent-safe digest');
select tests.eq((select count(*) from public.responses), 0, 'parent can never read raw responses');
select tests.eq((select count(*) from public.results), 0, 'parent cannot read results table');
select tests.eq((select count(*) from public.assessment_sessions), 0, 'parent cannot read sessions');
select tests.eq((select count(*) from public.profiles), 1, 'parent sees only their own profile row');
select tests.eq((select count(*) from public.favorites), 0, 'parent cannot read child favorites table directly');
select tests.throws($$insert into public.consents (student_id, route, method, guardian_name, guardian_relation, guardian_user_id, policy_version)
                      values ('00000000-0000-0000-0000-000000000003', 'parent_account', 'in_app', 'P', 'father', auth.uid(), 'v1')$$,
                    '42501', 'parent cannot grant consent for an unlinked child');
reset role;

select tests.login('00000000-0000-0000-0000-000000000005');
select tests.eq((select count(*) from public.student_summary), 0, 'unrelated parent sees nothing');
reset role;

-- analytics views are pseudonymous and role-gated
select tests.login('00000000-0000-0000-0000-000000000009');
select tests.eq((select count(*) from public.analytics_results), 1, 'analyst reads pseudonymous results');
select tests.eq((select count(*) from public.analytics_responses), 1, 'analyst reads pseudonymous responses');
select tests.eq((select count(*) from public.responses), 0, 'analyst gets no rows from the raw responses table');
reset role;
select tests.login('00000000-0000-0000-0000-000000000001');
select tests.eq((select count(*) from public.analytics_results), 0, 'student cannot use analytics views');
reset role;

-- withdrawal: parent summary disappears, open full session is paused, gate closes
select tests.login('00000000-0000-0000-0000-000000000001');
select tests.lives($$select public.withdraw_consent((select v::uuid from tests.ctx where k = 'consent'), 'changed my mind')$$, 'student can withdraw consent');
select tests.throws($$update public.assessment_sessions set status = 'in_progress' where id = '00000000-0000-0000-0000-0000000000d1'$$,
                    '42501', 'cannot resume the full session after consent withdrawal');
select tests.throws($$insert into public.responses (session_id, user_id, instrument_id, item_id, value)
                     values ('00000000-0000-0000-0000-0000000000d1', auth.uid(), 'interests', 'ri_004', 3)$$,
                    '42501', 'cannot answer after consent withdrawal');
select tests.throws($$insert into public.favorites (user_id, career_id) values (auth.uid(), 'zz_draft')$$, '42501', 'withdrawal re-locks favorites');
select tests.throws($$update public.roadmaps set title = 'new' where id = '00000000-0000-0000-0000-0000000000e1'$$, '42501', 'withdrawal re-locks roadmap updates');
select tests.throws($$update public.milestones set status = 'doing' where roadmap_id = '00000000-0000-0000-0000-0000000000e1'$$, '42501', 'withdrawal re-locks milestone updates');
select tests.affects($$delete from public.favorites where user_id = auth.uid()$$, 1, 'withdrawn minor can still delete their own favorites');
reset role;
select tests.ok((select status = 'paused' from public.assessment_sessions where id = '00000000-0000-0000-0000-0000000000d1'),
                'withdrawal paused the open full session');
select tests.login('00000000-0000-0000-0000-000000000004');
select tests.eq((select count(*) from public.student_summary), 0, 'withdrawn consent hides the summary from the parent');
reset role;
select tests.login('00000000-0000-0000-0000-000000000009');
select tests.eq((select count(*) from public.analytics_results), 0, 'withdrawn consent removes data from analytics');
reset role;
select tests.throws($$update public.consents set withdrawn_at = null where id = (select v::uuid from tests.ctx where k = 'consent')$$,
                    '42501', 'withdrawal is final');

-- parent-account consent route (new consent after withdrawal)
select tests.login('00000000-0000-0000-0000-000000000004');
select tests.lives($$insert into public.consents (student_id, route, method, guardian_name, guardian_relation, guardian_user_id, policy_version)
                    values ('00000000-0000-0000-0000-000000000001', 'parent_account', 'in_app', 'Baba', 'father', auth.uid(), 'v1')$$,
                   'linked parent with an account can grant consent in-app');
select tests.eq((select count(*) from public.student_summary), 1, 'summary is visible again under the new consent');
reset role;

-- =============================================================================
-- F. Back-office roles
-- =============================================================================
select tests.login('00000000-0000-0000-0000-000000000006');   -- content_editor
select tests.ok(public.has_admin_role('content_editor'), 'has_admin_role(content_editor) for the editor');
select tests.ok(not public.has_admin_role('analyst'), 'editor is not an analyst');
select tests.eq((select count(*) from public.careers where id like 'zz\_%'), 2, 'editor sees drafts too');
select tests.lives($$insert into public.careers (id, cluster_id, name) values ('zz_ed', 'zz_cluster', '{"en":"Ed","ar":"إد"}')$$, 'content_editor can create a career');
select tests.affects($$update public.careers set status = 'review' where id = 'zz_ed'$$, 1, 'content_editor can update a career');
select tests.throws($$update public.careers set status = 'published' where id = 'zz_ed'$$, '23514', 'cannot publish a career without traits / review date');
select tests.throws($$insert into public.opportunities (type, title, status) values ('job', '{"en":"j","ar":"ج"}', 'published')$$, '23514',
                    'cannot publish an opportunity without source_url + verification');
select tests.throws($$insert into public.opportunities (type, title, is_sponsored) values ('job', '{"en":"j","ar":"ج"}', true)$$, '23514',
                    'sponsored opportunities need a sponsor name');
select tests.throws($$insert into public.admin_roles (user_id, role) values (auth.uid(), 'super_admin')$$, '42501', 'editor cannot grant roles');
select tests.eq((select count(*) from public.audit_log), 0, 'editor cannot read audit_log');
select tests.eq((select count(*) from public.consents), 0, 'editor cannot read consents');
reset role;

select tests.login('00000000-0000-0000-0000-000000000007');   -- data_curator
select tests.lives($$insert into public.institutions (slug, name, type) values ('zz-uni', '{"en":"U","ar":"ج"}', 'public_university')$$, 'data_curator can create institutions');
select tests.lives($$insert into public.opportunities (type, title) values ('internship', '{"en":"i","ar":"ت"}')$$, 'data_curator can create opportunities');
reset role;
update public.admin_roles set revoked_at = now() where user_id = '00000000-0000-0000-0000-000000000007';
select tests.login('00000000-0000-0000-0000-000000000007');
select tests.throws($$insert into public.institutions (slug, name, type) values ('zz-uni2', '{"en":"U","ar":"ج"}', 'public_university')$$, '42501', 'a revoked role loses access');
reset role;

select tests.login('00000000-0000-0000-0000-000000000008');   -- assessment_lead
select tests.throws($$insert into public.careers (id, cluster_id, name) values ('zz_al', 'zz_cluster', '{"en":"x","ar":"x"}')$$, '42501', 'assessment_lead cannot write careers');
select tests.lives($$insert into public.instrument_versions (instrument_id, version, kind, content) values ('zzinst', '1', 'likert', '{"items":[]}')$$, 'assessment_lead can create an instrument version');
select tests.affects($$update public.instrument_versions set status = 'active', approved_at = now(), published_at = now() where instrument_id = 'zzinst'$$, 1, 'assessment_lead activates it');
select tests.throws($$update public.instrument_versions set content = '{"items":[1]}' where instrument_id = 'zzinst'$$, '42501', 'active instrument content is frozen');
reset role;
select tests.login('00000000-0000-0000-0000-000000000001');
select tests.eq((select count(*) from public.instrument_versions where instrument_id = 'zzinst'), 1, 'student reads the active instrument');
select tests.eq((select count(*) from public.instrument_keys), 0, 'student cannot read answer keys');
reset role;

select tests.login('00000000-0000-0000-0000-000000000010');   -- support
select tests.throws($$insert into public.careers (id, cluster_id, name) values ('zz_sp', 'zz_cluster', '{"en":"x","ar":"x"}')$$, '42501', 'support cannot write careers');
select tests.eq((select count(*) from public.profiles), 12, 'support can read profiles');
reset role;

select tests.login('00000000-0000-0000-0000-000000000011');   -- super_admin
select tests.ok(public.has_admin_role('analyst'), 'super_admin implies every role');
select tests.lives($$insert into public.admin_roles (user_id, role) values ('00000000-0000-0000-0000-000000000010', 'analyst')$$, 'super_admin can grant roles');
select tests.throws($$insert into public.admin_roles (user_id, role) values ('00000000-0000-0000-0000-000000000001', 'analyst')$$, '23514', 'roles can only go to admin profiles');
select tests.ok((select count(*) from public.audit_log where entity_type = 'careers' and entity_id = 'zz_ed') >= 1, 'super_admin reads the audit trail of the editor''s change');
select tests.ok((select count(*) from public.audit_log where entity_type = 'admin_roles') >= 1, 'role grants are audited');
-- audit minimisation: ids / method / status / policy_version / changed field NAMES only
select tests.ok((select count(*) from public.audit_log where entity_type = 'consents') >= 2, 'consent grant + withdrawal are audited');
select tests.eq((select count(*) from public.audit_log where entity_type = 'consents'
                   and (coalesce(after::text, '') || coalesce(before::text, '') || context::text)
                       ~* '(Mama|Baba|201001234567|changed my mind|"ua"|guardian_name|guardian_phone|guardian_email|"evidence")'), 0,
                'audit_log holds no guardian name / phone / email / free text for consents');
select tests.ok((select bool_and(after ? 'policy_version' and after ? 'method' and after ? 'route')
                   from public.audit_log where entity_type = 'consents' and action = 'insert'), 'consent audit keeps route, method, policy_version');
select tests.ok((select context -> 'changed_fields' ? 'withdrawn_at' from public.audit_log
                  where entity_type = 'consents' and action = 'update' order by created_at desc limit 1), 'withdrawal audit lists changed field NAMES');
select tests.ok((select count(*) from public.audit_log where entity_type = 'profiles') >= 1, 'profile role/dob changes are audited');
select tests.eq((select count(*) from public.audit_log where entity_type = 'profiles'
                   and (coalesce(after, '{}'::jsonb) ?| array['display_name', 'date_of_birth', 'phone', 'school_name', 'governorate']
                        or coalesce(before, '{}'::jsonb) ?| array['display_name', 'date_of_birth', 'phone', 'school_name', 'governorate'])), 0,
                'audit_log holds no profile personal data (ids and role only)');
select tests.throws($$update public.audit_log set action = 'other'$$, '42501', 'audit_log is append-only');
select tests.throws($$delete from public.audit_log$$, '42501', 'audit_log rows cannot be deleted');
select tests.lives($$insert into public.feature_flags (key, enabled) values ('zz.flag', true)$$, 'super_admin can write feature flags');
reset role;
select tests.login('00000000-0000-0000-0000-000000000006');
select tests.throws($$insert into public.feature_flags (key, enabled) values ('zz.flag2', true)$$, '42501', 'editor cannot write feature flags');
reset role;

-- =============================================================================
-- G. Reports, queue, notifications
-- =============================================================================
select tests.login('00000000-0000-0000-0000-000000000001');
select tests.lives($$insert into public.opportunity_reports (opportunity_id, user_id, reason, details)
                    values ('00000000-0000-0000-0000-0000000000a1', auth.uid(), 'broken_link', '404')$$, 'student can report an opportunity');
select tests.throws($$insert into public.opportunity_reports (opportunity_id, user_id, reason)
                    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000003', 'expired')$$, '42501', 'cannot file a report as someone else');
select tests.eq((select count(*) from public.review_queue), 0, 'student cannot read the review queue');
reset role;
select tests.login('00000000-0000-0000-0000-000000000003');
select tests.eq((select count(*) from public.opportunity_reports), 0, 'reports are private to the reporter');
reset role;
select tests.ok((select count(*) from public.review_queue where entity_type = 'opportunity' and reason = 'user_report') = 1, 'report landed in review_queue');

-- =============================================================================
-- H. Schools (B2B): invite-then-accept, school-route consent
-- =============================================================================
select tests.login('00000000-0000-0000-0000-000000000012');
select tests.lives($$insert into public.org_members (org_id, user_id, role, status)
                    values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000003', 'student', 'active')$$,
                   'org admin can invite a student');
select tests.throws($$insert into public.consents (student_id, route, method, guardian_name, guardian_relation, organization_id, policy_version)
                      values ('00000000-0000-0000-0000-000000000003', 'school', 'school_attestation', 'Principal', 'school',
                              '00000000-0000-0000-0000-0000000000b1', 'v1')$$,
                    '42501', 'school cannot attest consent for a student who has not accepted membership');
reset role;
select tests.ok((select status = 'invited' from public.org_members where user_id = '00000000-0000-0000-0000-000000000003'),
                'org admin cannot force status = active');
select tests.login('00000000-0000-0000-0000-000000000003');
select tests.affects($$update public.org_members set status = 'active' where user_id = auth.uid()$$, 1, 'student accepts school membership');
reset role;
select tests.login('00000000-0000-0000-0000-000000000012');
select tests.eq((select count(*) from public.student_summary), 0, 'no school consent yet => staff see no summary');
select tests.lives($$insert into public.consents (student_id, route, method, guardian_name, guardian_relation, organization_id, policy_version)
                    values ('00000000-0000-0000-0000-000000000003', 'school', 'school_attestation', 'Principal', 'school',
                            '00000000-0000-0000-0000-0000000000b1', 'v1')$$,
                   'school staff records school-route consent for an accepted member');
select tests.eq((select count(*) from public.student_summary), 1, 'school staff see the summary of the consented member only');
select tests.eq((select count(*) from public.responses), 0, 'school staff never see raw responses');
reset role;

-- =============================================================================
-- I. MX-13 consent flows: invite lifecycle, parent-account route, class codes
-- =============================================================================
reset role;
create function tests.service() returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $f$;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000013', 'p13@t.test', '{"role":"parent"}'),
  ('00000000-0000-0000-0000-000000000014', 'c14@t.test', '{"role":"student"}'),
  ('00000000-0000-0000-0000-000000000015', 's15@t.test', '{"role":"student"}'),
  ('00000000-0000-0000-0000-000000000016', 's16@t.test', '{"role":"student"}');
update public.profiles set date_of_birth = current_date - interval '14 years', display_name = 'Nour'
 where id = '00000000-0000-0000-0000-000000000015';
update public.profiles set phone = '+201005550001' where id = '00000000-0000-0000-0000-000000000013';

-- the new lifecycle functions are backend-only
select tests.login('00000000-0000-0000-0000-000000000015');
select tests.throws($$select public.consent_invite_create('00000000-0000-0000-0000-000000000015', '+201005550001', 'Mama', repeat('a', 64))$$,
                    '42501', 'students cannot call consent_invite_create directly');
select tests.throws($$select public.consent_invite_confirm(repeat('a', 64), '00000000-0000-0000-0000-000000000013', '+201005550001', 'Mama', 'mother', 'v1')$$,
                    '42501', 'authenticated users cannot confirm an invite');
select tests.throws($$select public.family_add_child('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000014', 'X', date '2012-01-01', null, 'mother', 'M', 'v1')$$,
                    '42501', 'authenticated users cannot call family_add_child');
select tests.throws($$select public.org_join_by_code('00000000-0000-0000-0000-000000000015', 'CLASS123')$$,
                    '42501', 'authenticated users cannot call org_join_by_code');
reset role;
select tests.anon();
select tests.throws($$select public.consent_invite_lookup(repeat('a', 64))$$, '42501', 'anon cannot look invites up');
reset role;

-- backend (service_role): create -> send budget -> open -> decline/confirm
select tests.service();
select tests.lives($$select * from public.consent_invite_create('00000000-0000-0000-0000-000000000015', '+201005550001', 'Mama', repeat('a', 64))$$,
                   'backend creates an invite from a token HASH');
select tests.throws($$select * from public.consent_invite_create('00000000-0000-0000-0000-000000000004', '+201005550001', 'x', repeat('b', 64))$$,
                    '42501', 'only students can invite');
select tests.throws($$select * from public.consent_invite_create('00000000-0000-0000-0000-000000000015', '+201005550001', 'x', 'not-hex')$$,
                    '22023', 'token hash must be sha-256 hex');
select tests.lives($$select * from public.consent_invite_register_send((select invite_id from public.consent_invite_lookup(repeat('a', 64))))$$, 'first send logged');
select tests.lives($$select * from public.consent_invite_register_send((select invite_id from public.consent_invite_lookup(repeat('a', 64))))$$, 'resend 1');
select tests.lives($$select * from public.consent_invite_register_send((select invite_id from public.consent_invite_lookup(repeat('a', 64))))$$, 'resend 2');
select tests.lives($$select * from public.consent_invite_register_send((select invite_id from public.consent_invite_lookup(repeat('a', 64))))$$, 'resend 3');
select tests.throws($$select * from public.consent_invite_register_send((select invite_id from public.consent_invite_lookup(repeat('a', 64))))$$,
                    '54000', 'a 4th resend within a day is refused');
select tests.ok((select opened_at is null from public.consent_invite_lookup(repeat('a', 64))), 'invite starts unopened');
select tests.ok(public.consent_invite_rotate((select invite_id from public.consent_invite_lookup(repeat('a', 64))), repeat('d', 64)), 'a resend rotates the token hash');
select tests.eq((select count(*) from public.consent_invite_lookup(repeat('a', 64))), 0, 'the previous link stops resolving');
select tests.eq((select count(*) from public.consent_invite_lookup(repeat('d', 64))), 1, 'the new link resolves');
select tests.ok(public.consent_invite_rotate((select invite_id from public.consent_invite_lookup(repeat('d', 64))), repeat('a', 64)), 'rotate back for the rest of the flow');
select tests.ok(public.consent_invite_mark_opened(repeat('a', 64)), 'opening marks the invite');
select tests.ok((select opened_at is not null from public.consent_invite_lookup(repeat('a', 64))), 'opened_at is set');
select tests.throws($$select public.consent_invite_confirm(repeat('a', 64), '00000000-0000-0000-0000-000000000013', '+201009999999', 'Mama', 'mother', 'v1')$$,
                    'P0001', 'confirmation must come from the invited number');
select tests.throws($$select public.consent_invite_confirm(repeat('a', 64), '00000000-0000-0000-0000-000000000016', '+201005550001', 'Mama', 'mother', 'v1')$$,
                    '42501', 'only a parent account can be the guardian');
select tests.ok(public.consent_invite_confirm(repeat('a', 64), '00000000-0000-0000-0000-000000000013', '+201005550001', 'Mama Nour', 'mother', 'consent-0.1-draft', '{"checks":[1,2,3,4,5,6]}') is not null,
                'parent confirms the invite');
reset role;
select tests.ok((select route = 'teen_invite' and method = 'whatsapp_link' and guardian_user_id = '00000000-0000-0000-0000-000000000013'
                        and guardian_phone = '+201005550001' and invite_id is not null
                   from public.consents where student_id = '00000000-0000-0000-0000-000000000015'),
                'teen_invite consent carries the guardian account + phone');
select tests.ok((select status = 'active' and requested_by = student_id from public.parent_links
                  where parent_id = '00000000-0000-0000-0000-000000000013' and student_id = '00000000-0000-0000-0000-000000000015'),
                'confirming creates the active parent link');
select tests.ok((select used_at is not null from public.consent_invites where student_id = '00000000-0000-0000-0000-000000000015'), 'invite is marked used');
select tests.service();
select tests.throws($$select public.consent_invite_confirm(repeat('a', 64), '00000000-0000-0000-0000-000000000013', '+201005550001', 'Mama', 'mother', 'v1')$$,
                    'P0001', 'a used invite cannot be confirmed twice');
select tests.ok(not public.consent_invite_decline(repeat('a', 64)), 'a used invite cannot be declined');
select tests.lives($$select * from public.consent_invite_create('00000000-0000-0000-0000-000000000016', '+201005550002', null, repeat('c', 64))$$, 'second invite (other student)');
select tests.ok(public.consent_invite_decline(repeat('c', 64)), 'guardian declines');
select tests.ok(not public.consent_invite_mark_opened(repeat('c', 64)), 'a declined invite cannot be opened again');
select tests.throws($$select public.consent_invite_confirm(repeat('c', 64), '00000000-0000-0000-0000-000000000013', '+201005550002', 'M', 'mother', 'v1')$$,
                    'P0001', 'a declined invite cannot be confirmed');
select tests.throws($$select * from public.consent_invite_register_send((select invite_id from public.consent_invite_lookup(repeat('c', 64))))$$,
                    'P0001', 'a declined invite cannot be re-sent');
reset role;

-- the guardian account can withdraw, which locks the full assessment again
select tests.ok(public.can_start_full_assessment('00000000-0000-0000-0000-000000000015'), 'minor can start a full session after the invite consent');
select tests.login('00000000-0000-0000-0000-000000000013');
select tests.lives($$select public.withdraw_consent((select id from public.consents where guardian_user_id = auth.uid()), 'test')$$, 'guardian withdraws the invite-route consent');
reset role;
select tests.ok(not public.can_start_full_assessment('00000000-0000-0000-0000-000000000015'), 'withdrawal locks the full assessment');
select tests.ok(not public.can_use_engagement('00000000-0000-0000-0000-000000000015'), 'withdrawal locks engagement features');

-- route B: parent adds a child
select tests.service();
select tests.throws($$select public.family_add_child('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000016', 'Old', date '2000-01-01', null, 'mother', 'Mama', 'v1')$$,
                    '22023', 'family_add_child refuses an adult');
select tests.throws($$select public.family_add_child('00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000016', 'Kid', date '2012-05-05', null, 'mother', 'Mama', 'v1')$$,
                    '42501', 'only a parent account can add a child');
select tests.throws($$select public.family_add_child('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000015', 'Kid', date '2012-05-05', null, 'mother', 'Mama', 'v1')$$,
                    '42501', 'a parent cannot adopt an existing student profile that already has a DOB');
select tests.ok(public.family_add_child('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000014', 'Omar', date '2012-05-05', 'Nile School', 'father', 'Baba', 'consent-0.1-draft', '{}') is not null,
                'parent adds a child');
select tests.throws($$select public.family_add_child('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000014', 'Omar', date '2012-05-05', null, 'father', 'Baba', 'v1')$$,
                    '42501', 'the same child cannot be added twice (no longer a fresh profile)');
reset role;
select tests.ok((select route = 'parent_account' and method = 'in_app' and guardian_user_id = '00000000-0000-0000-0000-000000000013'
                   from public.consents where student_id = '00000000-0000-0000-0000-000000000014'),
                'parent_account consent recorded at creation');
select tests.ok(public.can_start_full_assessment('00000000-0000-0000-0000-000000000014'), 'child may start once the parent has consented');
select tests.ok((select school_name = 'Nile School' and display_name = 'Omar' from public.profiles where id = '00000000-0000-0000-0000-000000000014'), 'child profile filled');

-- route C: class codes
select tests.login('00000000-0000-0000-0000-000000000012');
select tests.lives($$insert into public.org_join_codes (org_id, code, cohort, created_by)
                    values ('00000000-0000-0000-0000-0000000000b1', 'CLASS123', 'Grade 10A', auth.uid())$$, 'org admin creates a class code');
select tests.eq((select count(*) from public.org_join_codes), 1, 'org admin sees own codes');
reset role;
select tests.login('00000000-0000-0000-0000-000000000016');
select tests.eq((select count(*) from public.org_join_codes), 0, 'students cannot read class codes');
select tests.throws($$insert into public.org_join_codes (org_id, code) values ('00000000-0000-0000-0000-0000000000b1', 'STUDENT1')$$,
                    '42501', 'students cannot create class codes');
reset role;
select tests.service();
select tests.throws($$select * from public.org_join_by_code('00000000-0000-0000-0000-000000000016', 'NOPE1234')$$, 'P0001', 'unknown class code is rejected');
select tests.lives($$select * from public.org_join_by_code('00000000-0000-0000-0000-000000000016', ' class123 ')$$, 'student joins with a (normalised) class code');
reset role;
select tests.ok((select status = 'active' and cohort = 'Grade 10A' and role = 'student' from public.org_members
                  where user_id = '00000000-0000-0000-0000-000000000016'), 'membership is active with the cohort');
select tests.eq((select count(*) from public.consents where student_id = '00000000-0000-0000-0000-000000000016'), 0, 'joining a class grants no consent');
select tests.login('00000000-0000-0000-0000-000000000012');
select tests.lives($$insert into public.consents (student_id, route, method, guardian_name, guardian_relation, organization_id, policy_version)
                    values ('00000000-0000-0000-0000-000000000016', 'school', 'paper_form', 'Principal', 'school',
                            '00000000-0000-0000-0000-0000000000b1', 'consent-0.1-draft')$$, 'school records consent for a class-code member');
update public.org_join_codes set revoked_at = now() where code = 'CLASS123';
reset role;
select tests.service();
select tests.throws($$select * from public.org_join_by_code('00000000-0000-0000-0000-000000000003', 'CLASS123')$$, 'P0001', 'a revoked class code no longer works');
reset role;


\o
rollback;
\echo 'rls.sql: all assertions passed (transaction rolled back)'
