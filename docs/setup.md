# Bell setup

These steps need an account only the owner holds: Supabase, Google Cloud, Vercel, and DNS for `dontpanic.fyi`. Do them in order; each section ends with what to check before moving on.

Bell has its own Supabase project. Everything Bell stores lives in a `bell` schema there, and sign-in uses that project's Auth. Nothing in this repo names the project: its URL, keys and ref come from env (`.env.local` locally, Vercel and GitHub secrets in the cloud). Below, `<ref>` means the new project's ref.

## 1. Supabase: create the project, schema, migration, allowlist

1. **Create the project.** [supabase.com/dashboard](https://supabase.com/dashboard) → New project → name `bell`, a region near the team, a strong database password (keep it; `DATABASE_URL` needs it) → Create. When it is ready, collect from Project Settings:
   - **Project ref** (General) → `SUPABASE_PROJECT_REF`
   - **Project URL** `https://<ref>.supabase.co` (Data API) → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / publishable key** (API Keys) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role / secret key** (API Keys) → `SUPABASE_SERVICE_ROLE_KEY`
   - **Connection string** (top bar → Connect → Direct connection, or Session pooler if your network has no IPv6) with the password filled in → `DATABASE_URL`
2. **Local env.**
   ```sh
   cp .env.example .env.local
   ```
   Fill in the five values. `.env.local` is gitignored; the repo is public, so these never get committed.
3. **Expose the schema.** Project Settings → Data API → **Exposed schemas** → add `bell` → Save.
4. **Apply migration 0001.**
   ```sh
   npm ci
   npm run db:migrate
   ```
   It prints `applied 0001_bell.sql`. Re-running prints `0 migration(s) applied.` Applied files are recorded in `bell.migrations`.
   To have merges to `main` apply new migrations automatically, add `DATABASE_URL` as a repository secret (GitHub → Settings → Secrets and variables → Actions). The **Migrate** workflow does nothing until that secret exists, and can also be run by hand from the Actions tab.
5. **Invite people.** SQL editor:
   ```sql
   insert into bell.allowlist (email) values ('you@example.com');
   ```
   Emails are stored lowercase. Remove someone with `delete from bell.allowlist where email = '...';` and their next sign-in is refused.
6. Check: SQL editor `select * from bell.users;` runs (empty), and `select * from bell.migrations;` shows `0001_bell.sql`.

## 2. Google Cloud: OAuth client, Calendar API, domain

One OAuth client serves sign-in now and calendar access in Bell 1. Sign-in asks only for `openid email profile`; the Calendar scopes are requested later, when someone connects a calendar.

1. **Project.** [console.cloud.google.com](https://console.cloud.google.com) → project picker → New project → name `bell` → select it.
2. **Calendar API.** APIs & Services → Library → search "Google Calendar API" → Enable.
3. **Consent screen.** Google Auth Platform → Get started (or **Branding** if it exists):
   - App name `Bell`, user support email yours, developer contact yours.
   - App home page `https://bell.dontpanic.fyi`.
   - Authorized domains: `dontpanic.fyi` and `supabase.co`.
   - **Audience**: External. While it is in Testing, add every person who will sign in under Test users (100 max; Testing also expires Calendar refresh tokens after 7 days, so publish before Bell 1 ships).
   - **Data Access** → Add or remove scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `https://www.googleapis.com/auth/calendar.readonly`, `https://www.googleapis.com/auth/calendar.events.readonly`. The two Calendar scopes are sensitive; publishing to production with them starts Google's verification review.
4. **Client.** Google Auth Platform → Clients → Create client → Web application, name `Bell`.
   - Authorized JavaScript origins: `https://bell.dontpanic.fyi`, `http://localhost:3000`
   - Authorized redirect URIs:
     - `https://<ref>.supabase.co/auth/v1/callback` (Supabase Auth sign-in; use the ref from 1.1)
     - `https://bell.dontpanic.fyi/api/google/callback` (Bell's calendar connect flow, Bell 1)
     - `http://localhost:3000/api/google/callback` (same, local)
   - Create, then copy the **Client ID** and **Client secret**.
5. **Domain verification for push notifications.** Calendar push channels deliver to `https://bell.dontpanic.fyi/...`, and Google requires that domain to be verified to the project.
   - [Search Console](https://search.google.com/search-console) → Add property → **Domain** → `dontpanic.fyi` (covers `bell.`) → copy the `google-site-verification=...` TXT record → add it at your DNS host (section 5) → Verify.
   - Back in Cloud Console → APIs & Services → **Domain verification** → Add domain → `bell.dontpanic.fyi` → it confirms against the Search Console property.
   - The same verification satisfies the consent screen's authorized domain.

## 3. Supabase Auth: providers, URLs, the allowlist gate

1. **Google provider.** Authentication → Sign In / Providers → Google → Enable → paste the Client ID and Client secret from 2.4 → Save.
2. **Email.** Same page → Email → enabled. Magic links need nothing else.
3. **Signups.** Same page → **Allow new users to sign up** on. A first Google or magic-link sign-in creates the auth user, so this must be on; step 5 limits it to the allowlist.
4. **URLs.** Authentication → URL Configuration:
   - Site URL: `https://bell.dontpanic.fyi`
   - Redirect URLs: `https://bell.dontpanic.fyi/auth/callback**`, `http://localhost:3000/auth/callback**`, and your Vercel preview pattern, e.g. `https://bell-*-<team>.vercel.app/auth/callback**`
5. **Allowlist gate (recommended).** Authentication → Hooks → **Before User Created** → Postgres → schema `bell`, function `before_user_created` → Enable. Supabase then refuses to create any auth user whose email is not in `bell.allowlist`, so a stranger never gets an account at all: Google sign-in comes back to Bell's sign-in page with "That account is not invited to Bell", and a magic-link request shows "This email is not invited to Bell." Without the hook, Bell still refuses them at `/auth/callback`, but their auth user is left behind in Authentication → Users.
6. Check: Authentication → Users is empty.

## 4. Vercel: project, env, domain

1. **Project.** [vercel.com/new](https://vercel.com/new) → Import `Kprince1101/bell` → Project name `bell` → Framework Next.js (detected) → add env before the first deploy if it offers.
2. **Environment variables** (Settings → Environment Variables), for Production and Preview:

   | Name                            | Value                         | Sensitive |
   | ------------------------------- | ----------------------------- | --------- |
   | `NEXT_PUBLIC_SUPABASE_URL`      | `https://<ref>.supabase.co`   | no        |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key from 1.1         | no        |
   | `SUPABASE_SERVICE_ROLE_KEY`     | the service role key from 1.1 | yes       |

   The service role key is used only by `DELETE /api/account` to remove the auth user. `DATABASE_URL` and `SUPABASE_PROJECT_REF` do not go to Vercel.

3. **Domain.** Settings → Domains → Add `bell.dontpanic.fyi`. Vercel shows the DNS record it wants; add it in section 5.
4. **Deploy.** Deployments → Redeploy (or merge to `main`).

## 5. DNS for dontpanic.fyi

At the DNS host for `dontpanic.fyi`:

| Type  | Name | Value                                                          |
| ----- | ---- | -------------------------------------------------------------- |
| CNAME | bell | the value Vercel shows in 4.3 (usually `cname.vercel-dns.com`) |
| TXT   | @    | `google-site-verification=...` from Search Console (2.5)       |

Check: `https://bell.dontpanic.fyi` loads the Bell sign-in page with a valid certificate.

## 6. Prove it

1. Sign in with a Google account that is **not** on the allowlist → back on the sign-in page with "That account is not invited to Bell".
2. Add a second Google account to `bell.allowlist`, sign in → lands on the empty agenda, Account shows your browser's time zone.
3. Account → type `DELETE` → Delete my account → back on sign-in with "Your account and everything in it has been deleted".
4. In the SQL editor, with that account's id and email, every count is 0:
   ```sql
   select 'users' as t, count(*) from bell.users where id = '<id>' or email = '<email>'
   union all select 'allowlist', count(*) from bell.allowlist where email = '<email>'
   union all select 'auth.users', count(*) from auth.users where id = '<id>';
   ```
   Later Bell tables are covered by the same function: `bell.delete_me()` deletes from every `bell` table that has a `user_id` column, then the user row (which cascades), then the allowlist entry; the route then deletes the auth user.

## Conventions

- **Migrations** live in `supabase/migrations/NNNN_name.sql` and are applied by `npm run db:migrate`, which records them in `bell.migrations`.
- **Types**: after a migration, `SUPABASE_PROJECT_REF=<ref> npm run db:types` regenerates `types/supabase.ts` (needs `supabase login`).
- **Edge functions** in this repo are named `bell-*` under `supabase/functions/` and deployed with `SUPABASE_PROJECT_REF=<ref> npm run functions:deploy`. Bell 0 ships none.
