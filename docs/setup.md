# Bell setup

These steps need an account only the owner holds: Supabase dashboard, Google Cloud, Vercel, and DNS for `dontpanic.fyi`. Do them in order; each section ends with what to check before moving on.

Bell lives inside the Commander Supabase project (`jicqdcwrwhhcxohbdlbx`) under its own `bell` schema. Sign-in uses the same `auth.users` as Commander, which matters in three places called out below.

## 1. Supabase: schema, migration, allowlist

1. **Expose the schema.** Dashboard → project `jicqdcwrwhhcxohbdlbx` → Project Settings → Data API → **Exposed schemas** → add `bell` → Save. Keep `public` and anything else already listed.
2. **Apply migration 0001.** On your machine:
   ```sh
   cp .env.example .env.local
   ```
   Set `DATABASE_URL` in `.env.local` to the project's connection string (Dashboard → **Connect** → Direct connection, or Session pooler if your network has no IPv6), then:
   ```sh
   npm ci
   npm run db:migrate
   ```
   It prints `applied 0001_bell.sql`. Re-running prints `0 migration(s) applied.` The runner records what it applied in `bell.migrations`; it never touches Commander's own `supabase_migrations` history.
   To have merges to `main` apply new migrations automatically, add the same value as the repository secret `DATABASE_URL` (GitHub → Settings → Secrets and variables → Actions). The **Migrate** workflow does nothing until that secret exists, and can also be run by hand from the Actions tab.
3. **Invite people.** SQL editor:
   ```sql
   insert into bell.allowlist (email) values ('you@example.com');
   ```
   Emails are stored lowercase. Remove someone with `delete from bell.allowlist where email = '...';` and their next sign-in is refused.
4. Check: SQL editor `select * from bell.users;` runs (empty), and `select * from bell.migrations;` shows `0001_bell.sql`.

## 2. Google Cloud: OAuth client, Calendar API, domain

One OAuth client serves sign-in now and calendar access in Bell 1. Sign-in asks only for `openid email profile`; the Calendar scopes are requested later, when someone connects a calendar.

1. **Project.** [console.cloud.google.com](https://console.cloud.google.com) → project picker → New project → name `bell` (or reuse an existing one) → select it.
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
     - `https://jicqdcwrwhhcxohbdlbx.supabase.co/auth/v1/callback` (Supabase Auth sign-in)
     - `https://bell.dontpanic.fyi/api/google/callback` (Bell's calendar connect flow, Bell 1)
     - `http://localhost:3000/api/google/callback` (same, local)
   - Create, then copy the **Client ID** and **Client secret**.
5. **Domain verification for push notifications.** Calendar push channels deliver to `https://bell.dontpanic.fyi/...`, and Google requires that domain to be verified to the project.
   - [Search Console](https://search.google.com/search-console) → Add property → **Domain** → `dontpanic.fyi` (covers `bell.`) → copy the `google-site-verification=...` TXT record → add it at your DNS host (section 5) → Verify.
   - Back in Cloud Console → APIs & Services → **Domain verification** → Add domain → `bell.dontpanic.fyi` → it confirms against the Search Console property.
   - The same verification satisfies the consent screen's authorized domain.

## 3. Supabase Auth: providers, redirects, signup gate

1. **Google provider.** Authentication → Sign In / Providers → Google → Enable → paste the Client ID and Client secret from 2.4 → Save.
2. **Email.** Same page → Email → enabled. Magic links need nothing else.
3. **Signups.** Authentication → Sign In / Providers → **Allow new users to sign up** must be on, or a first Google or magic-link sign-in fails with "Signups not allowed". _Commander impact:_ this is project-wide, so it also lets anyone create an auth user in Commander's project. Step 5 closes that.
4. **Redirect URLs.** Authentication → URL Configuration → Redirect URLs → add:
   - `https://bell.dontpanic.fyi/auth/callback**`
   - `http://localhost:3000/auth/callback**`
   - your Vercel preview pattern, e.g. `https://bell-*-<team>.vercel.app/auth/callback**`

   Leave Site URL as Commander's.

5. **Signup gate (recommended).** Authentication → Hooks → **Before User Created** → Postgres → schema `bell`, function `before_user_created` → Enable. It rejects any new auth user whose email is not in `bell.allowlist`, so a stranger never gets an `auth.users` row. _Commander impact:_ it applies to Commander too: inviting a new Commander user whose email is not on `bell.allowlist` is rejected while the hook is on. Add them to the allowlist first, or turn the hook off for the invite. Without the hook, Bell still refuses uninvited people at `/auth/callback`, but their auth user is left in the project.
6. Check: Authentication → Users is unchanged so far.

## 4. Vercel: project, env, domain

1. **Project.** [vercel.com/new](https://vercel.com/new) → Import `Kprince1101/bell` → Project name `bell` → Framework Next.js (detected) → don't deploy yet if it offers env first.
2. **Environment variables** (Settings → Environment Variables), for Production and Preview:

   | Name                            | Value                                                         | Sensitive |
   | ------------------------------- | ------------------------------------------------------------- | --------- |
   | `NEXT_PUBLIC_SUPABASE_URL`      | `https://jicqdcwrwhhcxohbdlbx.supabase.co`                    | no        |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Commander's anon key (Supabase → Project Settings → API Keys) | no        |
   | `SUPABASE_SERVICE_ROLE_KEY`     | Commander's service role key (same page)                      | yes       |

   The service role key is used only by `DELETE /api/account` to remove the auth user. It never goes in the repo, which is public. `DATABASE_URL` does not go to Vercel.

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
   Later Bell tables are covered by the same function: `bell.delete_me()` deletes from every `bell` table that has a `user_id` column, then the user row (which cascades), then the allowlist entry.

## What Bell shares with Commander

- **`auth.users`.** Deleting a Bell account deletes the auth user. If someone signs in to Bell with the same email they use for Commander, deleting their Bell account also deletes their Commander login.
- **Signup settings and hooks** are project-wide (section 3).
- **Migrations.** Bell's live in `bell.migrations` and are applied by `npm run db:migrate`, never by `supabase db push`.
- **Edge functions** from this repo are named `bell-*` and deployed with `supabase functions deploy bell-<name> --project-ref jicqdcwrwhhcxohbdlbx`. Bell 0 ships none.
