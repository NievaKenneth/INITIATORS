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
approval logs. Admins do not receive administrative table access or RPC
privileges from this migration. Users can update only their own `full_name`;
direct table writes for role, status, permissions, and approval logs are
revoked. Superadmin-only database functions perform profile review, role/status
changes, and permission upserts/deletes. Review RPCs record the authenticated
reviewer in `approval_logs`. These database checks are independent of
application redirects or UI visibility.

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

Login, registration, forgot-password, and reset-password UI forms have not yet been connected. The profile and permission tables and their RLS policies are defined in the migration below; application-level role-based redirects and protected module routes still need to be implemented. Roles are not accepted from registration input.

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