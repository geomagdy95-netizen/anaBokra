# anaBokra database (Supabase / Postgres 15+)

Schema, migrations, row-level security (RLS), seed and tests for anaBokra (ticket MX-04).
43 tables + 3 views (11 migrations), all in `public`. Every table has RLS enabled; the last RLS migration fails if one is missing or has no policy.

```
supabase/
  migrations/   ordered SQL (apply in filename order)
  seed.sql      dev seed: clusters, 82 careers (2 published samples), instruments (draft), flags, settings
  tests/rls.sql plain-SQL assertions (202) for RLS, consent gate, guards; runs in a rolled-back transaction
  tests/support/local_shim.sql   stand-in for Supabase roles + auth schema, ONLY for vanilla Postgres
```

## Applying

Supabase CLI / self-hosted stack:

```bash
supabase db reset                 # applies migrations/ then seed.sql (local dev)
supabase db push                  # applies new migrations to a linked project
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql   # run the tests (safe: rolls back)
```

Plain Postgres (CI, scratch DB):

```bash
createdb mx_test
psql mx_test -v ON_ERROR_STOP=1 -f supabase/tests/support/local_shim.sql   # roles anon/authenticated/service_role + auth.users/uid()/role()
for f in supabase/migrations/*.sql; do psql mx_test -v ON_ERROR_STOP=1 -f "$f"; done
psql mx_test -v ON_ERROR_STOP=1 -f supabase/seed.sql
psql mx_test -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
```

No extensions are required (`gen_random_uuid`, `sha256` are core in PG13+).

| Migration | Contents |
| --- | --- |
| `…01_core` | enums, helpers (`has_admin_role`, `is_minor`, …), identity tables, signup trigger, guards |
| `…02_consent` | `consent_invites`, `consents`, consent functions |
| `…03_assessment` | instruments, sessions (consent gate), responses, results, readiness |
| `…04_content` | clusters, careers, country data, institutions, programs, opportunities, reports, review queue |
| `…05_engagement` | favorites, roadmaps, XP, achievements, goals, notifications |
| `…06_platform` | flags, settings, audit log, AI ledger, counselors/bookings/subscriptions, audit triggers |
| `…07_rls` | enable RLS everywhere, all policies, `student_summary` + analytics views, guard rail |
| `…08_grants_finalize` | `updated_at` triggers, least-privilege grants, function EXECUTE grants |
| `…09_engagement_gate_audit_minimization` | consent gate on engagement tables, personal-data-free audit log |
| `…10_saved_items` | saved programs / universities / providers / opportunities |
| `…11_consent_flows` | MX-13: invite `opened_at` / `declined_at` / `sends`, `org_join_codes` (class codes), service-role functions for the web backend (`consent_invite_*`, `family_add_child`, `org_join_by_code`) |

## Tables by area

**Identity** (5): `profiles` (1:1 `auth.users`; role student/parent/counselor/school_admin/admin; DOB, curriculum/track/budget = engine `UserContext`), `admin_roles` (super_admin, content_editor, data_curator, assessment_lead, support, analyst), `parent_links` (two-sided handshake), `organizations`, `org_members` (B2B, invite-then-accept).

**Consent** (2): `consents` (one table, routes `teen_invite | parent_account | school`; guardian identity, method, `policy_version`, `granted_at`, `withdrawn_at`, scope, evidence; append-only), `consent_invites` (sha-256 token hash, expiry, WhatsApp number).

**Assessment** (6): `instrument_versions` (JSON content, frozen once active), `instrument_keys` (answer keys, assessment_lead only), `assessment_sessions` (save/resume: status, station, progress, pinned instrument versions), `responses` (item id, value, ms), `results` (scores, matches, `assessment_version`, `norms_version`, quality, parent-safe `summary`), `readiness_checks` (pre/post).

**Content** (12): `clusters`, `careers` (text id from `catalog.json`, i18n name, traits jsonb, status draft/review/published/archived, `last_reviewed_at`), `career_country_data` (per country path/market jsonb), `industries`, `career_industries`, `institutions`, `programs`, `program_careers`, `opportunities` (type enum, sponsored flag, `source_url`, `source_type`, `verified_at/by`), `opportunity_careers`, `opportunity_reports` (user error reports; auto-enqueued), `review_queue`.

**Engagement** (10): `favorites`, `saved_opportunities` (keyed by `item_kind` + slug `item_id` for programs, universities, providers and opportunities; migration 10), `roadmaps`, `milestones`, `xp_events`, `achievements`, `user_achievements`, `weekly_goals`, `notifications`, `notification_prefs`.

**Platform** (7): `feature_flags`, `app_settings`, `audit_log` (append-only, row triggers on sensitive/editorial tables), `ai_generations` (prompt key, model, cost, flagged -> review_queue), and phase 2-3 `counselors`, `bookings`, `subscriptions`.

**Views**: `student_summary` (parent / school / self), `analytics_results`, `analytics_responses` (pseudonymous, analyst + assessment_lead).

Conventions: uuid PKs except content ids (text slugs: careers, clusters, industries, achievements); i18n columns are jsonb `{"en","ar"}` enforced by `is_i18n()`; `updated_at` maintained by trigger; country codes are ISO alpha-2 uppercase.

## RLS model

1. **Deny by default.** RLS on every table; `anon`/`authenticated` privileges are revoked and re-granted per table (and per column where needed, e.g. `consent_invites.token_hash` is unreadable, `notifications` allows updating only `read_at`).
2. **Students own their rows** (`user_id = auth.uid()`): profile, sessions, responses, readiness, favorites, roadmaps, milestones, goals, prefs.
3. **Server-owned tables** have no end-user write policy; write them with the `service_role` key: `results`, `xp_events`, `user_achievements`, `notifications` (insert), `subscriptions`, `audit_log`.
4. **Parents never read base tables of a child.** They read `student_summary`, which returns a row only if the parent link is `active` AND the student has an un-withdrawn, unexpired consent. It exposes the `results.summary` digest and counters, never responses, raw scores or quality flags. School staff get the same view when a *school-route* consent for their org is active and the student accepted membership. Support can read it too.
5. **Back-office** via `has_admin_role(role)` / `has_any_admin_role(roles[])` (SECURITY DEFINER; `super_admin` implies all). Matrix:
   - content (`careers`, `clusters`, country data, institutions, programs, opportunities, links, review queue, achievements): `content_editor` or `data_curator`
   - `instrument_versions`, `instrument_keys`: `assessment_lead`
   - `feature_flags`, `app_settings`, `admin_roles`: `super_admin`
   - `audit_log`: read by `super_admin` only; nobody can update/delete
   - `support`: read profiles, sessions (metadata), consents, summaries, reports, bookings; manage links/counselors
   - `analyst` / `assessment_lead`: pseudonymous analytics views only (students with active `data_processing` consent)
6. **Published content is public.** `anon` reads rows with `status = 'published'` (links follow their parents). Check constraints prevent publishing a career without traits and a review date, or an opportunity without `source_url` + human verification.
7. **Consent gate (minors).** `can_start_full_assessment(uid)` = student AND (18+ OR active `assessment` consent). Unknown DOB is treated as a minor. It is enforced three times: the RLS insert policy, a trigger on `assessment_sessions` (covers service-role writers; also blocks resuming), and `can_answer_session()` on every response write. Withdrawing the last consent pauses the open full session. `quick` (taster) sessions need no consent. Beyond assessments, minors without consent get teaser + onboarding only: a trigger (`engagement_consent_gate`, via `can_use_engagement()`) rejects inserts/updates on `favorites`, `saved_opportunities`, `roadmaps`, `milestones`, `weekly_goals` and `xp_events` (so it also binds the backend). Profile edits, notification prefs and deletes stay allowed.
8. **Anti-escalation guards (triggers):** users cannot change `profiles.role` or an already-set `date_of_birth`; signup can only create `student`/`parent`; admin roles go only to `role = 'admin'` profiles; parent links need acceptance by the other side; org admins can only *invite* members; consents are append-only and withdrawal is final.

### Consent flows

- **teen_invite:** student calls `create_consent_invite('whatsapp', '+20…')` (returns the raw token once; only its hash is stored) -> app sends the link -> an Edge Function calls `redeem_consent_invite(token, name, relation, policy_version, evidence)` as `anon` (rate-limit it) -> consent row.
- **parent_account:** linked parent inserts a `consents` row (route `parent_account`) from their account.
- **school:** org staff insert a `school` consent for a student who accepted org membership.
- **withdraw:** `withdraw_consent(id, reason)` (student, granting parent, org admin, or support).

MX-13 (web backend, service role; token passed as the hex SHA-256, the raw token never reaches the DB on this path):
- **teen_invite:** `consent_invite_create` (revokes the student's other live invites, max 6/day) -> `consent_invite_register_send` (atomic: 1 send + 3 resends per rolling 24h; `sends[]` is the send log) -> `consent_invite_rotate` on resend (fresh link, old one dies) -> landing page `consent_invite_mark_opened` -> parent verifies the invited number by OTP -> `consent_invite_confirm` (consent with `guardian_user_id`, active `parent_links`, invite used) or `consent_invite_decline`. Invite status is derived: pending -> opened -> granted | declined | expired | revoked.
- **parent_account:** `family_add_child` (child profile + active link + consent in one transaction; the backend creates the child's auth user from the teen's WhatsApp number, signing in with that number claims the profile).
- **school:** staff create `org_join_codes`; students join through `org_join_by_code` (this is the student's acceptance, no consent); staff then insert the `school` consent under RLS.

## Loading content

`seed.sql` is for dev only (clusters, all 82 careers as drafts with O*NET traits, two published samples, the five instruments as **draft**). Production loading is an importer (service role) that reads `packages/content`:

1. upsert `clusters` and `careers` from `catalog.json` + `careers.generated.json` (`traits` <- generated `traits`; keep `status`/`last_reviewed_at` untouched on re-import);
2. insert each instrument as a new `instrument_versions` row (`content` without `answerIndex`; answer keys into `instrument_keys`), then activate after psychologist approval: `update instrument_versions set status='active', approved_at=now(), published_at=now() where id=…`;
3. publish careers only after review: set `last_reviewed_at`, then `status='published'`.

## Adding a table

Add the table, enable RLS, add policies, **and** add explicit grants (default privileges are revoked for `anon`/`authenticated`). The guard rail at the end of `…07_rls` shows the check; re-run `tests/rls.sql`.

## Production notes

- `has_admin_role` and the other helpers live in `public` (as requested); they only answer questions about the caller. EXECUTE is granted to `authenticated` only (`redeem_consent_invite` also to `anon`).
- Bootstrap the first `super_admin` with SQL as `postgres`: set `profiles.role='admin'`, insert into `admin_roles`.
- `audit_log` never copies personal data: `consents` and `profiles` rows are logged through an allow-list (ids, route, method, policy_version, scope, timestamps; profiles: id + role) plus the NAMES of changed fields in `context.changed_fields`. No guardian name/phone/email, no free text.
- Audit retention: per lawyer, TBD. `audit_log` is append-only, so a purge job must disable the trigger deliberately.
- TODO(legal): parent summary of an 18+ student will require the adult student's own opt-in (see `can_view_student_summary`). Student self-withdrawal of consent is allowed, pending lawyer review.
