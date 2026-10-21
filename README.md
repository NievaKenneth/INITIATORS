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

JSON endpoints:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Password recovery uses a PKCE callback at `/auth/callback`. The callback destination is fixed to `/reset-password`, and the reset endpoint requires a verified Supabase recovery session.

Login, registration, forgot-password, and reset-password UI forms have not yet been connected. No profile table or role-claim schema is present, so role-based redirects still need an agreed role schema and destination pages. Roles are not accepted from registration input.

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