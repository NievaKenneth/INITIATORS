    # HOPE ERP System
**INITIATORS**

## Team Members & Roles
- **Scrum Master / UI/UX Designer:** Kenneth Nieva
- **Developer:** Clarence Llamas
- **DB Admin:** John Paul Felices
- **Tester:** Angelo Suarez

## Supabase Setup

Copy `.env.example` to `.env.local` and fill in the project URL and publishable key from your Supabase project settings. `.env.local` is ignored by Git. Never put a Supabase secret/service-role key in client-accessible environment variables.

The Supabase client is available from `src/lib/supabase/client.ts`. To check connectivity, request `/api/health/supabase`. It returns `{"status":"ok"}` on success and a 503 status when configuration or connectivity is unavailable.

## Authentication Backend

Authentication uses Supabase Auth through `@supabase/ssr`.

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `APP_URL` (server-only application origin for password-recovery redirects)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; used by protected admin user creation and listing)

Never prefix the service-role key with `NEXT_PUBLIC_`, expose it in a client
component, or commit its real value. `.env.example` contains only a placeholder.

The reusable `register` and `login` Server Actions are in `src/app/actions/auth.ts`. They accept email and password through `useActionState`. Email is normalized and validated on the server. Passwords must be 12–128 characters and are sent directly to Supabase Auth, never stored in an application table. Registration responses do not disclose whether an email is already registered.

`logout` signs out and redirects to `/`. `getCurrentUser` verifies the current user, and `requireUser` redirects unauthenticated users to `/login`. Use these helpers in server-side code before returning protected data. Next.js `proxy.ts` refreshes Supabase sessions but is not an authorization boundary.

## Database foundation and access control

The initial schema migration is
`supabase/migrations/20261021130400_create_profiles_and_access_control.sql`.
It creates `public.profiles`, `public.module_permissions`, and
`public.approval_logs`, enables RLS on each table, and installs a trigger that
creates a `user`/`pending` profile whenever Supabase Auth creates an account.
The trigger reads only the optional `full_name` user metadata; it never reads a
role or status from signup metadata. Existing Auth accounts without a profile
are backfilled as `user`/`pending`.

Apply migrations with the Supabase CLI after linking this repository to the
intended project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Review the target project and migration SQL before applying it. This migration
creates objects and backfills profiles; it does not apply itself, alter
existing Auth accounts, or bootstrap a superadmin.

RLS allows authenticated users to read their own profile and module
permissions. Approved superadmins can read all profiles, permissions, and
approval logs. Users can update only their own `full_name`; direct table writes
for role, status, permissions, and approval logs are revoked. Superadmin-only
database functions perform profile review, role/status changes, and permission
upserts/deletes. Review RPCs record the authenticated reviewer in
`approval_logs`. These database checks are independent of application
redirects or UI visibility.

The follow-up migration
`supabase/migrations/20261025090000_admin_user_management_access.sql` allows
approved admins to read profiles through RLS. The user-management migration
`supabase/migrations/20261025100000_user_management_actions.sql` restricts
profile review to pending accounts, adds a role-only RPC for superadmins, and
adds block/unblock for approved admins and superadmins. The protected
`/api/admin/users` endpoint creates Auth accounts with the existing trigger's
`user`/`pending` defaults; it never accepts a role or approval status from the
request. To apply pending migrations to a running local Supabase stack, run
`supabase migration up`. For a linked remote project, review the SQL and run
`supabase db push`.

An approved superadmin cannot reject their own profile or use the access RPC
to remove their own `superadmin` role or `approved` status. Self-targeted
access changes are accepted only when the resulting profile remains an
approved superadmin; use another approved superadmin to demote, reject, or
block an account. This prevents an accidental last-superadmin lockout.
Permission RPCs reject missing or nonexistent target profiles, blank or
overlong module names, and NULL permission flags explicitly.

Approval-log profile references use `ON DELETE RESTRICT` to retain the review
history; account deletion therefore requires a separately reviewed retention
or archival process.

### Initial superadmin bootstrap

Do not use public registration to bootstrap a superadmin. First have the
intended person register normally and complete email confirmation. A trusted
project owner should verify the person's identity and the exact confirmed
email address through the project’s trusted onboarding process. Then, in the
Supabase SQL Editor as a trusted database operator, run this one-time block
after replacing the placeholder with that verified email:

```sql
do $$
declare
  target_email text := 'REPLACE_WITH_VERIFIED_EMAIL';
  target_user_id uuid;
  matching_users bigint;
  updated_rows integer;
begin
  if target_email = 'REPLACE_WITH_VERIFIED_EMAIL' then
    raise exception 'Set the verified target email before running this block';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(81120420261021);

  if exists (
    select 1
    from public.profiles
    where role = 'superadmin'
  ) then
    raise exception 'A superadmin already exists; bootstrap is one-time only';
  end if;

  select pg_catalog.count(*)
  into matching_users
  from auth.users
  where pg_catalog.lower(email) = pg_catalog.lower(target_email)
    and email_confirmed_at is not null;

  if matching_users <> 1 then
    raise exception 'Expected exactly one confirmed Auth account for the verified email';
  end if;

  select id
  into target_user_id
  from auth.users
  where pg_catalog.lower(email) = pg_catalog.lower(target_email)
    and email_confirmed_at is not null;

  update public.profiles
  set role = 'superadmin',
      status = 'approved'
  where id = target_user_id;

  get diagnostics updated_rows = row_count;
  if updated_rows <> 1 then
    raise exception 'Expected exactly one profile for the verified account';
  end if;
end;
$$;
```

Verify the resulting profile by querying `public.profiles` for the verified
email's Auth user ID and confirm `role = 'superadmin'` and `status = 'approved'`.
Do not paste credentials, service-role keys, or session tokens into SQL or
application/browser configuration. If bootstrap must be repeated, have a
trusted database operator review and authorize a separate recovery procedure;
do not weaken the one-time guard.

### SQL authorization checks

Run these checks only in a disposable project. Prepare fixture accounts for
each listed profile state and substitute their UUIDs below. In the Supabase SQL
Editor, `SET LOCAL ROLE` plus `request.jwt.claim.sub` simulates an authenticated
request for RLS and `auth.uid()` checks; it does not create a real Auth session.
Every test transaction, whether its statements succeed or raise an expected
error, must end with `ROLLBACK` so test changes are not retained. Start every
separate test transaction by repeating `BEGIN`, `SET LOCAL ROLE`, and
`set_config('request.jwt.claim.sub', ..., true)` for that session before running
the test. Run each expected-error statement in its own transaction and roll it
back before starting the next test. Do not group expected-error statements in
one transaction: PostgreSQL marks that transaction failed after the first
error.

For an anonymous test transaction:

```sql
begin;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
-- Run one test here, then roll back even if it succeeded.
rollback;
```

For an authenticated test transaction, replace the UUID with the fixture
user for the session. Repeat all three setup statements for every new
transaction:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<fixture-user-uuid>', true);
-- Run one test here, then roll back even if it succeeded.
rollback;
```

Expected authorization results:

| Session | Checks |
| --- | --- |
| Anonymous | Selecting from `public.profiles` and attempting an administrative RPC must fail for lack of privileges. |
| Pending user | Can select only their own profile and permissions. Updating their own `full_name` succeeds; updating `role` or `status` fails for lack of column privilege. Administrative RPC calls fail with `42501`. |
| Approved regular user | Same own-row and own-name behavior as pending; administrative RPC calls fail with `42501`. |
| Admin | Same database permissions as an approved regular user; the `admin` role alone grants no administrative table or RPC access. |
| Approved superadmin | Can select all profiles, permissions, and approval logs; administrative RPCs succeed for other fixture users. An attempt to reject or remove their own approved-superadmin access fails. |

Under each authenticated session, also verify direct writes to
`module_permissions` and `approval_logs` fail for lack of table privileges,
including for an approved superadmin. Use existing fixture IDs:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<fixture-user-uuid>', true);
insert into public.module_permissions (user_id, module_name)
values ('<fixture-user-uuid>', 'SQL authorization test');
rollback; -- Run even when the INSERT raises the expected error.
```

Run the other expected-error INSERT in a separate transaction, repeating all
setup:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<fixture-user-uuid>', true);
insert into public.approval_logs (user_id, approved_by, decision)
values ('<fixture-user-uuid>', '<fixture-superadmin-uuid>', 'approved');
rollback; -- Run even when the INSERT raises the expected error.
```

For a non-superadmin session, verify the own-name-only rule and administrative
RPC denial using its fixture UUID:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<fixture-user-uuid>', true);
select id, role, status from public.profiles; -- only own profile is visible
update public.profiles set full_name = 'SQL authorization test'
where id = '<fixture-user-uuid>'; -- succeeds for own row
rollback; -- Discard the successful full_name update before the next test.
```

Run each expected-error statement below in its own transaction, repeating
`BEGIN`, `SET LOCAL ROLE`, and `set_config` each time, then `ROLLBACK` even
after the expected error:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<fixture-user-uuid>', true);
update public.profiles set role = 'admin'
where id = '<fixture-user-uuid>'; -- expected: permission denied
rollback;
```

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<fixture-user-uuid>', true);
update public.profiles set status = 'approved'
where id = '<fixture-user-uuid>'; -- expected: permission denied
rollback;
```

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<fixture-user-uuid>', true);
select public.set_profile_access('<fixture-user-uuid>', 'admin', 'approved');
-- expected: 42501 (RPC authorization check)
rollback;
```

For an approved-superadmin session, call `review_profile` for a pending
fixture, `set_profile_access` for another fixture, and
`set_module_permissions`/`delete_module_permissions` for an existing fixture.
Run the successful RPC checks in a transaction with the superadmin's repeated
session setup, then `ROLLBACK` to discard their changes. Verify invalid
arguments (NULL or nonexistent target profile IDs, NULL or invalid
role/status/decision values, NULL/blank/over-100-character module names, and
NULL permission flags) fail with `22023`. Test each invalid call separately:
start a new transaction, repeat `BEGIN`, `SET LOCAL ROLE authenticated`, and
`set_config('request.jwt.claim.sub', '<fixture-superadmin-uuid>', true)`, run
one call, and `ROLLBACK` even when it raises an error. Apply the same separate
transaction setup and rollback to check that `review_profile` cannot reject
the caller and `set_profile_access` cannot change the caller away from
`superadmin`/`approved`.

JSON endpoints:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Password recovery uses a PKCE callback at `/auth/callback`. The callback destination is fixed to `/reset-password`, and the reset endpoint requires a verified Supabase recovery session.

Login, registration, forgot-password, and reset-password UI forms have not yet been connected. The profile and permission tables and their RLS policies are defined in the migration below. Roles are not accepted from registration input. The dashboard requires an approved `admin` or `superadmin` profile; protected module routes and admin APIs have not been implemented.

### Local test accounts

The test-account seed command is strictly limited to a local Supabase Auth URL
(`http://localhost`, `http://127.0.0.1`, or `http://[::1]`). It refuses to run
if any superadmin or any configured test email already exists. It creates three
confirmed local Auth users, bootstraps only the newly-created superadmin profile
with the local service-role key, then assigns the `user` and `admin` profiles
through the existing `set_profile_access` RPC while authenticated as that
superadmin. It verifies all three profiles are `approved` and verifies that
both non-superadmin roles receive SQLSTATE `42501` from the role-management
RPC. It does not touch hosted Supabase projects or promote existing accounts.

Apply the migration to a disposable local Supabase instance first. In
PowerShell, set these values only in the current shell; use unique test emails
and strong test-only passwords. Do not commit the service-role key or test
passwords, and do not set the service-role key under a `NEXT_PUBLIC_` name:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "<local-publishable-key>"
$env:SUPABASE_SERVICE_ROLE_KEY = "<local-service-role-key>"
$env:SUPABASE_TEST_USER_EMAIL = "hope-user@example.test"
$env:SUPABASE_TEST_USER_PASSWORD = "<unique-test-password-12-or-more-characters>"
$env:SUPABASE_TEST_ADMIN_EMAIL = "hope-admin@example.test"
$env:SUPABASE_TEST_ADMIN_PASSWORD = "<unique-test-password-12-or-more-characters>"
$env:SUPABASE_TEST_SUPERADMIN_EMAIL = "hope-superadmin@example.test"
$env:SUPABASE_TEST_SUPERADMIN_PASSWORD = "<unique-test-password-12-or-more-characters>"
npm.cmd run seed:test-accounts
```

Required seed environment variables are `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_TEST_USER_EMAIL`, `SUPABASE_TEST_USER_PASSWORD`,
`SUPABASE_TEST_ADMIN_EMAIL`, `SUPABASE_TEST_ADMIN_PASSWORD`,
`SUPABASE_TEST_SUPERADMIN_EMAIL`, and
`SUPABASE_TEST_SUPERADMIN_PASSWORD`. The script uses the service-role key only
in the local Node process; it is never imported by app code or exposed to a
browser. The three passwords are used for local testing only.

Sign in at `/login` with each account and confirm dashboard access: approved
admins and superadmins are allowed; users, pending accounts, and unauthenticated
visitors are redirected away. The proxy redirects unauthenticated dashboard
requests to `/login`; the server-rendered dashboard independently checks the
authenticated user's approved profile and role. Current `/api/auth/*` and
`/api/health/supabase` endpoints are public authentication/health endpoints;
there are no application admin-only or superadmin-only API routes yet.

Database authorization remains stricter than the dashboard UI: the migration
grants role/status management and module-permission RPC execution only to an
approved superadmin. Admins have the same database privileges as approved
regular users, and direct role/status writes remain revoked for authenticated
users. The seed script exercises the role-management denial for both `user`
and `admin`; use the SQL authorization checks above for broader RLS and RPC
coverage. No superadmin permissions beyond those declared by the migration
should be inferred from the dashboard's demo controls.

For local testing, set `APP_URL` to `http://localhost:3000`. Add the callback URL to Supabase Auth's allowed redirect URLs and configure the recovery email template. Verify the full flow using your actual Supabase project.

## Getting Started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Create `.env.local` using `.env.example` before testing Supabase features.

---

## Branch Naming Guidelines

All team members must follow this branch naming convention:

**Format:** `Feature/RoleInitials-LastName-short-description`

### Role Initials
- **SM:** Scrum Master
- **UIX:** UI/UX Designer
- **DEV:** Developer
- **DBA:** Database Administrator
- **TST:** Tester

### Examples
- Scrum Master: `Feature/SM-Nieva-readme-guidelines`
- UI/UX Designer: `Feature/UIX-Nieva-auth-layouts`
- Developer: `Feature/DEV-Llamas-auth-api`
- DB Admin: `Feature/DBA-LastName-db-schema`
- Tester: `Feature/TST-LastName-test-plan`

**Rule:** Direct commits to `main` are prohibited. Push changes on your feature branch and open a Pull Request linking to your issue.