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