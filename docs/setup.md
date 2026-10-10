# Bell setup

These steps need an account only the owner holds: Supabase, Google Cloud, Vercel, and DNS for `dontpanic.fyi`. Do them in order; each section ends with what to check before moving on.

Bell lives in the existing Commander Supabase project, entirely inside its own `bell` schema. Nothing in this repo names the project: its URL, keys and ref come from env (`.env.local` locally, Vercel and GitHub secrets in the cloud). Below, `<ref>` means that project's ref.

**No project-wide auth setting changes for Bell.** "Allow new users to sign up" stays off, no auth hook is added, the Site URL and email templates stay as they are. Bell decides who gets in with its own `bell.allowlist`, checked in Bell's code.

## 1. Supabase: expose the `bell` schema and apply the bell migrations

1. **Local env.**

   ```sh
   cp .env.example .env.local
   ```

   Fill in from the project's dashboard:
   - `SUPABASE_PROJECT_REF`: Project Settings → General → Project ID
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://<ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`: Project Settings → API Keys
   - `DATABASE_URL`: top bar → Connect → Direct connection (or Session pooler if your network has no IPv6), password filled in

   `.env.local` is gitignored; the repo is public, so these never get committed.

2. **Expose the schema.** Project Settings → Data API → **Exposed schemas** → add `bell` → Save. Keep every schema already listed.
3. **Apply the bell migrations.**
   ```sh
   npm ci
   npm run db:migrate
   ```
   It prints `applied 0001_bell.sql`. Re-running prints `0 migration(s) applied.` The runner only creates objects in the `bell` schema and records what it applied in `bell.migrations`; it never touches the project's own `supabase_migrations` history or any other schema.
   To have merges to `main` apply new bell migrations automatically, add `DATABASE_URL` as a repository secret (GitHub → Settings → Secrets and variables → Actions). The **Migrate** workflow does nothing until that secret exists, and can also be run by hand from the Actions tab.
4. **Make yourself the owner.** SQL editor, with the email of your existing login:
   ```sql
   insert into bell.allowlist (email, role) values ('you@example.com', 'owner');
   ```
5. Check: `select * from bell.migrations;` shows `0001_bell.sql`, and `select * from bell.allowlist;` shows you as `owner`.

## 2. Inviting people

Signed in to Bell as the owner, open **Invites** and add an email. Bell adds it to `bell.allowlist` and, through a service-role server action, creates a confirmed auth user for it if none exists (no email is sent). That person can then sign in with Google, using the same address, or with an email link. Someone who already has a login in the project, such as a Commander user, keeps that same login.

## 3. Google Cloud: OAuth client, Calendar API, domain

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
     - `https://<ref>.supabase.co/auth/v1/callback` (Supabase Auth sign-in)
     - `https://bell.dontpanic.fyi/api/google/callback` (Bell's calendar connect flow, Bell 1)
     - `http://localhost:3000/api/google/callback` (same, local)
   - Create, then copy the **Client ID** and **Client secret**.
5. **Domain verification for push notifications.** Calendar push channels deliver to `https://bell.dontpanic.fyi/...`, and Google requires that domain to be verified to the project.
   - [Search Console](https://search.google.com/search-console) → Add property → **Domain** → `dontpanic.fyi` (covers `bell.`) → copy the `google-site-verification=...` TXT record → add it at your DNS host (section 6) → Verify.
   - Back in Cloud Console → APIs & Services → **Domain verification** → Add domain → `bell.dontpanic.fyi` → it confirms against the Search Console property.
   - The same verification satisfies the consent screen's authorized domain.

## 4. Supabase Auth: Google provider and redirect URLs

1. **Google provider.** Authentication → Sign In / Providers → Google → Enable → paste the Client ID and Client secret from 3.4 → Save. With signups off, this lets existing users sign in with Google; it does not let anyone new create a login.
2. **Redirect URLs.** Authentication → URL Configuration → Redirect URLs → **add** these alongside Commander's existing entries, never replacing them:
   - `https://bell.dontpanic.fyi/auth/callback**`
   - `http://localhost:3000/auth/callback**`
   - your Vercel preview pattern, e.g. `https://bell-*-<team>.vercel.app/auth/callback**`
3. Check: the Redirect URLs list still contains every entry it had before, plus Bell's; "Allow new users to sign up" is still off.

## 5. Vercel: project, env, domain

1. **Project.** [vercel.com/new](https://vercel.com/new) → Import `Kprince1101/bell` → Project name `bell` → Framework Next.js (detected) → add env before the first deploy if it offers.
2. **Environment variables** (Settings → Environment Variables), for Production and Preview:

   | Name                            | Value                         | Sensitive |
   | ------------------------------- | ----------------------------- | --------- |
   | `NEXT_PUBLIC_SUPABASE_URL`      | `https://<ref>.supabase.co`   | no        |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key from 1.1         | no        |
   | `SUPABASE_SERVICE_ROLE_KEY`     | the service role key from 1.1 | yes       |

   The service role key is used only by Bell's server: the Invites action and `DELETE /api/account`. `DATABASE_URL` and `SUPABASE_PROJECT_REF` do not go to Vercel.

3. **Domain.** Settings → Domains → Add `bell.dontpanic.fyi`. Vercel shows the DNS record it wants; add it in section 6.
4. **Deploy.** Deployments → Redeploy (or merge to `main`).

## 6. DNS for dontpanic.fyi

At the DNS host for `dontpanic.fyi`:

| Type  | Name | Value                                                          |
| ----- | ---- | -------------------------------------------------------------- |
| CNAME | bell | the value Vercel shows in 5.3 (usually `cname.vercel-dns.com`) |
| TXT   | @    | `google-site-verification=...` from Search Console (3.5)       |

Check: `https://bell.dontpanic.fyi` loads the Bell sign-in page with a valid certificate.

## 7. Prove it

1. Sign in with a Google account that is **not** on the allowlist → back on the sign-in page with "That account is not invited to Bell". An address with no login is stopped by Supabase because signups are off; an existing login that is not on the allowlist is signed straight back out by `/auth/callback`.
2. As the owner, invite a second Google account on **Invites**, then sign in with it → lands on the empty agenda, Account shows your browser's time zone.
3. As that account: Account → type `DELETE` → Delete my account → back on sign-in with "Your account and everything in it has been deleted".
4. In the SQL editor, with that account's id and email, every count is 0:
   ```sql
   select 'users' as t, count(*) from bell.users where id = '<id>' or email = '<email>'
   union all select 'allowlist', count(*) from bell.allowlist where email = '<email>'
   union all select 'auth.users', count(*) from auth.users where id = '<id>';
   ```

`bell.delete_me()` deletes from every `bell` table that has a `user_id` column, then the user row (which cascades), then the allowlist entry, and reports whether the login may go. `DELETE /api/account` removes the auth user only when that user has no `public.profiles` row, so deleting a Bell account never removes a Commander login.

## Conventions

- **Migrations** live in `supabase/migrations/NNNN_name.sql`, create objects only in the `bell` schema, and are applied by `npm run db:migrate`.
- **Types**: after a migration, `SUPABASE_PROJECT_REF=<ref> npm run db:types` regenerates `types/supabase.ts` (needs `supabase login`).
- **Edge functions** in this repo are named `bell-*` under `supabase/functions/` and deployed with `SUPABASE_PROJECT_REF=<ref> npm run functions:deploy`. Bell 0 ships none.
