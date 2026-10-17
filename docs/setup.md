# Bell runbook

This is how Bell goes live and how to tell whether it is running. The go-live checklist comes first. Sections 1 to 9 hold the detail it points to, section 10 explains the Health page, and section 11 is what to check when a notification did not arrive. Section 12 covers the agenda (Bell 2) and section 13 sharing a calendar with a teammate (Bell 4).

These steps need an account only the owner holds: Supabase, Google Cloud, Vercel, DNS for `dontpanic.fyi`, Slack, Pushover and Twilio.

Bell lives in the existing Commander Supabase project, entirely inside its own `bell` schema. Nothing in this repo names the project: its URL, keys and ref come from env (`.env.local` locally, Vercel and GitHub secrets in the cloud). Below, `<ref>` means that project's ref. The repo is public, so it holds secret names only, never values.

**No project-wide auth setting changes for Bell.** "Allow new users to sign up" stays off, no auth hook is added, the Site URL and email templates stay as they are. Bell decides who gets in with its own `bell.allowlist`, checked in Bell's code.

## Go-live checklist

**A. Accounts, once.** Skip whatever is already done. Each line points to the section with the clicks.

- [ ] `.env.local` filled in for the Commander project, and `bell` added to its **Exposed schemas** without removing any (1.1, 1.2).
- [ ] You are on `bell.allowlist` as `owner` (1.4).
- [ ] Google Cloud: Calendar API on; consent screen with `openid email profile` and both Calendar scopes; OAuth client with Bell's redirect URIs; `bell.dontpanic.fyi` domain-verified; app **published** (3, 8.3).
- [ ] Supabase Auth: Google provider on, and Bell's redirect URLs **added alongside Commander's**. Signups stay off and no other auth setting changes (4).
- [ ] Vercel project with the domain, and DNS records for `bell` and the Google TXT (5.1, 5.3, 6).
- [ ] Slack app with its redirect URL, interactivity URL and public distribution (9.1). Pushover application (9.2). Twilio number with Voice and SMS, registered for A2P 10DLC or toll-free verified (9.3).

**B. Go live, about ten minutes.**

1. [ ] **Migrate.** Run `npm run db:migrate`. It applies whatever is pending in file-name order and ends with `N migration(s) applied.`. Check `select name from bell.migrations order by name;`: it lists every file in `supabase/migrations`, `0001` through `0006`. The **Migrate** workflow does the same on each merge to `main` once `DATABASE_URL` is a repository secret.
2. [ ] **Deploy functions.** Run `npm run deploy:functions`, which reads `SUPABASE_PROJECT_REF` from `.env.local`.
   - It deploys every `bell-*` folder in `supabase/functions` to that project.
   - It then prints each function's secrets as `set` or `MISSING`, names only, and exits non-zero if any is missing. Set those with `supabase secrets set --project-ref <ref> NAME=value`.
   - Bell ships no edge functions today, because the scheduler and every webhook are Next.js routes. So it prints `nothing to deploy` and lists the app secrets, which belong in Vercel instead.
3. [ ] **Set the secrets in Vercel.** Settings → Environment Variables, Production, then Redeploy. Every name under `app` in `supabase/functions/secrets.json` must be set; the tables in 5.2 and 9.4 say where each value comes from. The ones people forget:
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (9.3)
   - `PUSHOVER_APP_TOKEN` (9.2)
   - `CRON_SECRET`, which must match the value stored in Vault in step 4
4. [ ] **Verify the cron job.** If 9.5 has not been run yet, run it now. Then in the SQL editor:
   ```sql
   select jobname, schedule, active from cron.job where jobname = 'bell-notify';
   select d.status, d.return_message, d.start_time
   from cron.job_run_details d join cron.job j on j.jobid = d.jobid
   where j.jobname = 'bell-notify' order by d.start_time desc limit 3;
   ```
   Expect one job, `* * * * *`, active, with runs that `succeeded` within the last minute. Vercel → Logs shows a `[bell] notify-tick` line every minute. Commander's own cron jobs are untouched; only `bell-notify` is Bell's.
5. [ ] **Twilio webhook URLs.** On the number, set Messaging → A message comes in → `https://bell.dontpanic.fyi/api/webhooks/twilio/sms`, HTTP POST. Leave Voice unset: Bell gives each call its own callback to `/api/webhooks/twilio/voice`.
6. [ ] **Google OAuth.** The client's redirect URIs include `https://<ref>.supabase.co/auth/v1/callback` and `https://bell.dontpanic.fyi/api/google/callback`, and the app is in production. Supabase's Redirect URLs list still has every Commander entry, plus `https://bell.dontpanic.fyi/auth/callback**`.
7. [ ] **Sign in** at `https://bell.dontpanic.fyi` as the owner. The header shows **Invites** and **Health**. Invite anyone else from **Invites** (section 2); nobody is added through auth settings.
8. [ ] **Add the first source.** Calendars → **Connect a Google account** → consent → tick at least one calendar → **Save calendars**. It shows "Last synced ..." within seconds.
9. [ ] **Channels.** On Notifications, **Add to Slack**, paste your Pushover user key, enter your mobile number, and press **Test** on each channel. Each test must arrive.
10. [ ] **Send a test notification.** Create a meeting 3 minutes out on an included calendar. Within a minute the Pushover emergency push and the SMS arrive. Acknowledge the push, and no call comes.
11. [ ] **Health is all green.** Open Health. Every row should be green, or grey for a channel you switched off on purpose. A red row names what to fix, and section 10 explains each one.

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

   | Name                            | Value                                                   | Sensitive |
   | ------------------------------- | ------------------------------------------------------- | --------- |
   | `NEXT_PUBLIC_SUPABASE_URL`      | `https://<ref>.supabase.co`                             | no        |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key from 1.1                                   | no        |
   | `SUPABASE_SERVICE_ROLE_KEY`     | the service role key from 1.1                           | yes       |
   | `BELL_APP_URL`                  | `https://bell.dontpanic.fyi` (Production only, see 8.1) | no        |
   | `GOOGLE_CLIENT_ID`              | Client ID from 3.4                                      | no        |
   | `GOOGLE_CLIENT_SECRET`          | Client secret from 3.4                                  | yes       |
   | `BELL_TOKEN_KEY`                | output of `openssl rand -base64 32`                     | yes       |
   | `BELL_WEBHOOK_SECRET`           | output of `openssl rand -base64 48`                     | yes       |
   | `CRON_SECRET`                   | output of `openssl rand -base64 48`                     | yes       |

   The service role key is used only by Bell's server: the Invites action, `DELETE /api/account`, and the Google sync (Bell 1), which writes calendars and events. None of these values go in the repo, which is public. `DATABASE_URL` and `SUPABASE_PROJECT_REF` do not go to Vercel.

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

## 8. Bell 1: Google calendars

Bell never polls Google. Each included calendar has a watch channel that makes Google POST to `https://bell.dontpanic.fyi/api/webhooks/google` when something changes; Bell then pulls only the delta with the stored sync token. The only timer is the scheduler tick, and it only renews channels.

1. **Secrets.** Add the six Bell 1 variables from 5.2 to Vercel (Production; Preview too if you want to connect from a preview, but `BELL_APP_URL` must stay the verified domain because Google only delivers pushes there). Redeploy.
   - `BELL_TOKEN_KEY` encrypts every stored Google refresh token (AES-256-GCM, in `bell.account_secrets`, which only the service role can read). Keep a copy somewhere safe: if it is lost or changed, every connected account has to be disconnected and connected again.
   - `BELL_WEBHOOK_SECRET` signs each channel's token, so Bell can tell Google's notifications from forged ones. Changing it makes existing channels fail verification until the next renewal; disconnect and reconnect to recover sooner.
   - For local work put the same names in `.env.local` with `BELL_APP_URL=http://localhost:3000`. Connecting works locally; push notifications do not, because Google only calls the verified HTTPS domain.
2. **Migration 0002.** `npm run db:migrate` prints `applied 0002_google_calendars.sql` (or the **Migrate** workflow does it on merge). Check: `select name from bell.migrations;` lists both files.
3. **Google Cloud.**
   - Confirm 3.4 has the redirect URI `https://bell.dontpanic.fyi/api/google/callback` and 3.3 has the `openid`, `email`, and both Calendar scopes. Bell asks for `openid email` alongside the two Calendar scopes so it can tell your Google accounts apart.
   - Confirm 3.5 is done: APIs & Services → **Domain verification** lists `bell.dontpanic.fyi`. Without it, registering a watch channel fails with "Unauthorized WebHook callback channel" and the calendar shows as unhealthy.
   - **Publish the app** (Google Auth Platform → Audience → Publish app). In Testing, Google expires Calendar refresh tokens after 7 days and every calendar goes unhealthy.
4. **Scheduler tick.** `GET` or `POST https://bell.dontpanic.fyi/api/tick` with header `Authorization: Bearer <CRON_SECRET>` renews every channel that expires within 24 hours and marks calendars whose push has stopped as unhealthy. Since Bell 3 the same tick also sends meeting notifications, and section 9.5 schedules it every minute. Channels last 7 days, so a missed tick only matters to renewals after several days.
5. **Prove it.**
   1. Calendars → **Connect a Google account** → pick your personal account → consent. Repeat for a second account (a client Workspace).
   2. Tick three calendars across the two accounts, give each a color, **Save calendars**. Each shows "Last synced ..." within a few seconds.
   3. Create an event in any of the three in Google Calendar. Within seconds:
      ```sql
      select title, starts_at, status, fingerprint from bell.events order by last_seen_at desc limit 5;
      ```
      shows it. Move it: same row, new `starts_at` and `fingerprint`. Delete it: same row, `status = 'cancelled'`.
   4. Vercel → Logs, filter `[bell]`: every `[bell] sync` line says `trigger=webhook` or `trigger=connect`, never anything else; tick runs log only `[bell] watch`, `[bell] unwatch` and `[bell] tick` lines. That is the proof no calendar is fetched on a timer.
   5. Disconnect one account: its calendars and events are gone (`select count(*) from bell.events e join bell.calendars c on c.id = e.calendar_id where c.account_id = '<id>';` is 0) and it no longer appears under myaccount.google.com → Security → Third-party connections.

## 9. Bell 3: notifications that cannot be ignored

For each meeting on an included calendar Bell escalates until someone acknowledges it: a Slack DM and a normal push 30 minutes out; a high-priority push and the same Slack DM updated at 10 minutes; a Pushover emergency push (repeats every 30 seconds for 10 minutes, breaks through quiet modes) and an SMS at 2 minutes; a phone call at the start. Pressing Acknowledge in Slack or in Bell, acknowledging the Pushover emergency push, replying to the SMS, or pressing any key on the call stops everything left for that meeting. All-day meetings and calendars marked quiet never ring. If a channel fails, Bell tries the next one (Slack, Pushover, SMS, call) and records the failure.

Bell owns one Slack app, one Pushover application and one Twilio number. Every credential below comes from env only; the repo holds placeholders in `.env.example`.

1. **Slack app** ([api.slack.com/apps](https://api.slack.com/apps) → Create New App → From scratch → name `Bell`, pick any workspace you admin as the development workspace).
   - **OAuth & Permissions** → Redirect URLs → add `https://bell.dontpanic.fyi/api/slack/callback` (and `http://localhost:3000/api/slack/callback` for local work) → Save. **Bot Token Scopes**: `chat:write`, `im:write`, `users:read`. No user scopes.
   - **Interactivity & Shortcuts** → On → Request URL `https://bell.dontpanic.fyi/api/webhooks/slack` → Save. This is where the Acknowledge button lands; Bell checks Slack's signature on every request.
   - **App Home** → Show Tabs → Messages Tab on, and tick "Allow users to send Slash commands and messages from the messages tab" off. Display name `Bell`.
   - **Manage Distribution** → work through the checklist → **Activate Public Distribution**. Without it the app installs only in the development workspace; with it, anyone can add Bell to Toptal's, NAIC's or a client's workspace (an admin there may have to approve it first).
   - **Basic Information** → App Credentials → copy **Client ID**, **Client Secret**, **Signing Secret**.
2. **Pushover application** ([pushover.net/apps/build](https://pushover.net/apps/build)) → name `Bell`, type Application, upload the bell icon if you like → Create → copy the **API Token/Key**. Each person pastes their own **user key** (top of their pushover.net dashboard) into Bell → Notifications, and needs the Pushover app on their phone.
3. **Twilio number** ([console.twilio.com](https://console.twilio.com)).
   - Upgrade the account (a trial can only text and call verified numbers and prefixes every message).
   - Phone Numbers → Buy a number → a US local number with **Voice** and **SMS**. To text US phones, register it for A2P 10DLC (Messaging → Regulatory Compliance) or buy a toll-free number and complete toll-free verification; unregistered numbers get filtered.
   - On the number: **Messaging** → A message comes in → Webhook `https://bell.dontpanic.fyi/api/webhooks/twilio/sms`, HTTP POST → Save. Voice needs no configuration: Bell places calls itself and the keypress comes back to `/api/webhooks/twilio/voice`.
   - Account Info → copy the **Account SID** and **Auth Token**; the number in `+1...` form is `TWILIO_FROM_NUMBER`. Bell checks Twilio's signature with the Auth Token, so rotating it means updating Vercel in the same minute.
4. **Vercel env** (Production, and Preview if you test there), then redeploy:

   | Name                   | Value                         | Sensitive |
   | ---------------------- | ----------------------------- | --------- |
   | `SLACK_CLIENT_ID`      | Slack Client ID from 9.1      | no        |
   | `SLACK_CLIENT_SECRET`  | Slack Client Secret from 9.1  | yes       |
   | `SLACK_SIGNING_SECRET` | Slack Signing Secret from 9.1 | yes       |
   | `PUSHOVER_APP_TOKEN`   | Pushover API token from 9.2   | yes       |
   | `TWILIO_ACCOUNT_SID`   | Twilio Account SID from 9.3   | no        |
   | `TWILIO_AUTH_TOKEN`    | Twilio Auth Token from 9.3    | yes       |
   | `TWILIO_FROM_NUMBER`   | the Twilio number, `+1...`    | no        |

   Slack bot tokens are stored encrypted with `BELL_TOKEN_KEY` in `bell.slack_installs`; phone numbers and Pushover keys live in `bell.channel_secrets`. Both tables are readable only by the service role.

5. **Migration 0004 and the one-minute scheduler.**
   - `npm run db:migrate` prints `applied 0004_notifications.sql` (or the **Migrate** workflow applies it on merge). If Bell 2's `0003` lands later it is applied then; the runner tracks names, not a counter.
   - The scheduler is the only timer in Bell: a `pg_cron` job named `bell-notify` that POSTs to `/api/tick` every minute. The tick materializes the steps of meetings starting in the next 35 minutes, sends what is due, skips what is acknowledged, and renews Google watch channels. It reads `bell.events` and `bell.notifications` and never fetches a calendar. Database → Extensions → make sure **pg_cron** and **pg_net** are enabled (Commander may already use them; enabling them changes no existing job, schema or auth setting), then in the SQL editor (paste the real `CRON_SECRET` from 5.2; Vault keeps it out of the job definition, and every name Bell adds starts with `bell`):
     ```sql
     select vault.create_secret('https://bell.dontpanic.fyi/api/tick', 'bell_tick_url');
     select vault.create_secret('<CRON_SECRET>', 'bell_cron_secret');
     select cron.schedule('bell-notify', '* * * * *', $$
       select net.http_post(
         url := (select decrypted_secret from vault.decrypted_secrets where name = 'bell_tick_url'),
         headers := jsonb_build_object(
           'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'bell_cron_secret'),
           'Content-Type', 'application/json'
         ),
         body := '{}'::jsonb,
         timeout_milliseconds := 30000
       );
     $$);
     ```
     Check after two minutes: `select status_code from net._http_response order by created desc limit 3;` shows `200`s, and Vercel → Logs shows a `[bell] notify-tick` line every minute. If you added a Vercel Cron or another caller for `/api/tick` under Bell 1, remove it.
6. **Prove it.**
   1. Bell → **Notifications** → **Add to Slack** → pick a workspace → Allow. You land back with "Slack connected" and Bell's DM arrives. Paste your Pushover user key, Save, **Test**: a push arrives. Enter your mobile number, Save, **Test** SMS and **Test** call.
   2. On a connected Google calendar, create a meeting 3 minutes out with a Meet link. Within a minute the phone gets the Pushover emergency push, repeating, and the SMS with title, time and join link. Acknowledge the push in the Pushover app: the repeats stop, the Slack DM (if any) changes to "Acknowledged", and no call comes at the start.
   3. Create another meeting 3 minutes out and ignore everything. At the start time your phone rings and reads the title and time; press any key and it says "Acknowledged".
   4. In the SQL editor, every step appears exactly once per meeting:
      ```sql
      select e.title, n.step, n.channel, n.result, n.error, n.sent_at, n.acknowledged_at, n.acknowledged_by
      from bell.notifications n join bell.events e on e.id = n.event_id
      order by e.starts_at desc, n.due_at, n.channel
      limit 20;
      ```
   5. Move one of your meetings by 15 minutes inside the next two hours: one push says it moved, and its steps follow the new time. Delete a meeting: nothing more rings for it. Mark its calendar quiet under Notifications → Quiet calendars: nothing rings for that calendar.

## 10. Health

**Health** lives at `/health` and appears in the header only for an `owner` on `bell.allowlist`, the same role that sees Invites. The page reads everything through `GET /api/health`, a service-role route that answers 403 to anyone else. **Check again** re-reads it.

Each row is red when something is wrong, grey when it is off on purpose, and green otherwise. Anything that should happen every minute turns red once it is more than 5 minutes old.

| Row                          | Green means                                                                               | When it is red                                                                                                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pg_cron job bell-notify      | `cron.job` has `bell-notify`, active                                                      | Enable pg_cron and pg_net and run the `cron.schedule` in 9.5                                                                                                                                                                                            |
| Last cron run                | the latest `bell-notify` run in `cron.job_run_details` succeeded, less than 5 minutes ago | The message is Postgres's. An old run means the job is off or pg_cron is stuck                                                                                                                                                                          |
| bell-notify (scheduler tick) | `/api/tick` finished less than 5 minutes ago                                              | It shows the error the tick hit. If the cron run is green but this is stale, the tick is being refused: the Vault `bell_cron_secret` differs from Vercel's `CRON_SECRET`, or `bell_tick_url` is wrong. Vercel → Logs has the `[bell] notify-tick` lines |
| bell-sync (Google push sync) | the last calendar sync succeeded                                                          | It shows Google's error. This row does not age: Bell syncs only when Google pushes, so a quiet hour is normal                                                                                                                                           |
| Last notification sent       | at least one notification has been sent                                                   | Do go-live step 10                                                                                                                                                                                                                                      |
| Delivery failures            | no failure since the last notification sent                                               | It names the channel and the provider's error; see section 11                                                                                                                                                                                           |
| Your channels                | each channel's last **Test** went through                                                 | Press Test on Notifications. A failure shows the provider's error                                                                                                                                                                                       |
| Your calendars               | each included calendar is healthy and has a live push channel                             | Unhealthy shows the sync error. A missing or expired channel is renewed by the next tick; otherwise disconnect and reconnect                                                                                                                            |
| App secrets (names only)     | every name under `app` in `supabase/functions/secrets.json` is set in this deployment     | Set it in Vercel and redeploy. Health never reads out a value, only whether it is set                                                                                                                                                                   |

Where the data comes from:

- The tick records its last run in `bell.job_runs` as `bell-notify`.
- Every calendar sync and every sync failure records `bell-sync` in the same table.
- Each **Test** stores its result in `bell.channel_tests`.

Migration `0005` adds both tables and `bell.health_report`. It is the only Bell function that reads the `cron` schema, and it looks only at the job named `bell-notify`. Health does not read `net._http_response`, because in the shared project that table also holds Commander's requests.

## 11. When a notification did not arrive

1. **Open Health.** If any Scheduler or Jobs row is red, fix that first: nothing is sent without the tick.
2. **Find the meeting's steps** in the SQL editor:
   ```sql
   select e.title, e.starts_at, e.status, n.step, n.channel, n.due_at, n.claimed_at, n.result, n.error, n.sent_at, n.acknowledged_at
   from bell.events e left join bell.notifications n on n.event_id = e.id
   where e.title ilike '%<part of the title>%'
   order by e.starts_at desc, n.due_at;
   ```
3. **Read the result.**
   - **No event row.** Bell never heard about the meeting. Check its calendar under Health → Your calendars, and make sure it is ticked on Calendars. If bell-sync is red with `invalid_grant`, connect that Google account again.
   - **An event row but no steps.** The calendar is quiet, the meeting is all-day or cancelled, or no channel was on with a key or number saved. Check Notifications.
   - **`claimed_at` is empty after `due_at`.** The tick is not running: see Health → Scheduler.
   - **`skipped`, with error `late` or `superseded`.** The tick was down when the step was due, and after an outage Bell sends only the latest step. Find out why the tick stopped.
   - **`cancelled`.** The meeting was cancelled or moved, its calendar went quiet, or that channel was switched off.
   - **`failed`.** `error` holds the provider's answer, and Bell tried the next channel (that row has `fallback_for` set). Press **Test** on the failed channel.
     - Twilio errors usually mean the number is not registered for A2P 10DLC (9.3) or the phone number is wrong.
     - Pushover errors mean a bad user key or a bad `PUSHOVER_APP_TOKEN`.
     - Slack `not_in_channel` or `account_inactive` means you need to Add to Slack again.
   - **`sent`, but nothing arrived.** Bell handed it to the provider, so look there.
     - Pushover: the app must be installed and signed in on the phone.
     - Twilio: Console → Monitor → Logs → Messaging or Calls shows the delivery status.
     - Slack: the DM comes from the Bell app, in the workspace you connected.
4. **Acknowledged too early?** `acknowledged_at` and `acknowledged_by` say who stopped it: a Slack button, the Pushover receipt, an SMS reply, a keypress on the call, or the app.

## 12. Bell 2: agenda

The agenda at `/` shows today and the next 7 days from every included calendar, in the time zone set on Account. It updates live: the browser subscribes to Supabase Realtime changes on `bell.events` for the signed-in user (RLS decides what it may see) and reloads the agenda when a sync lands.

1. **Migration 0003.** `npm run db:migrate` prints `applied 0003_agenda.sql` (or the **Migrate** workflow does it on merge). It adds:
   - `bell.events.changed_at` and `previous_starts_at`, stamped by a trigger whenever a sync adds, moves or cancels an event after the calendar's first sync. The agenda marks those changes for 24 hours.
   - `bell.calendars.paused`: a paused calendar keeps syncing but is hidden from the agenda.
   - `bell.agenda_visits`: when each user last looked, so "since you last looked" survives reloads.
   - `bell.events` in the `supabase_realtime` publication.
2. **Realtime.** Adding `bell.events` to the project's `supabase_realtime` publication is the one change 0003 makes outside the `bell` schema. It only adds that table; every table already in the publication stays as it was. Check: Database → Publications → `supabase_realtime` lists `bell.events`. If the migration ran before the publication existed, run `alter publication supabase_realtime add table bell.events;` in the SQL editor. Nothing else needs turning on; the browser uses the anon key and the user's session.
3. **Prove it.**
   1. With two Google accounts connected and three calendars included, invite both of your accounts to one meeting. The agenda shows it once, with both calendars' badges.
   2. Create an event at 1:00 PM in Google Calendar with its time zone set to Eastern (TZID `America/New_York`) while your Account time zone is Central. Its card shows a red flag: `12:00 PM CT · invite says 1:00 PM ET`.
   3. Open the agenda on a phone: the next event is pinned at the top and its countdown ticks every second.
   4. Move, cancel or create an event in Google Calendar. Within seconds, without reloading, the card shows **Moved** with the old time struck through, **Cancelled** with the title struck through, or **New**.
   5. Calendars → tick **Pause** on one calendar → Save: its events leave the agenda; untick to bring them back.

## 13. Bell 4: sharing a calendar with a teammate

A share is a row in `bell.calendar_shares` (calendar, the teammate it is shared with, who shared it), never a copy of the events. The sharer's watch channel keeps the events fresh; the teammate's agenda and scheduler read "my calendars plus calendars shared with me". The teammate never sees the sharer's Google account, refresh token or other calendars: they get the shared calendar's label and color through `bell.shared_with_me()` and its events through an RLS policy on `bell.events`.

1. **Migration 0006.** `npm run db:migrate` prints `applied 0006_calendar_shares.sql` (or the **Migrate** workflow does it on merge). It adds `bell.calendar_shares`, the shared-events read policy, per-person notification rows (`unique (event_id, user_id, step, channel)`), and extends `bell.delete_me()` to drop every share the user made or received (it still returns `false`, keeping the auth user, for someone with a Commander profile). Everything it creates lives in the `bell` schema; realtime needs nothing new.
2. **Invite the teammate.** Signed in as the owner, open **Invites** and add their email (section 2). They sign in once (Bell 0), keeping their existing login if they already use Commander, connect their own Google accounts if they have any (Bell 1), and set up their own Slack, Pushover, SMS and call channels under Notifications (Bell 3).
3. **Prove it.**
   1. Signed in as the sharer: Calendars → **Sharing** → type the teammate's email next to an included calendar → **Share**. The calendar now lists their email with **Stop sharing**.
   2. Signed in as the teammate: the agenda shows that calendar's meetings badged `<label> · shared`, and nothing from the sharer's other calendars. Calendars → **Sharing** → **Shared with you** lists it. The sharer's Google account appears nowhere.
   3. On the shared calendar, create a meeting 35 minutes out. Each person gets their own Slack DM and push on their own channels and in their own time zone; acknowledging on one side does not silence the other. Marking the calendar quiet silences only the sharer.
   4. The sharer presses **Stop sharing** (or the teammate presses **Remove**): the meetings leave the teammate's agenda and nothing more rings for them; `select result, error from bell.notifications where user_id = '<teammate id>' order by created_at desc limit 7;` shows `cancelled` / `share removed`.
   5. If the sharer deletes their Bell account (Account → Delete), the shares, the shared events and every notification queued for the teammate go with it.
4. **Sharing tells you who has a Bell account.** Sharing with an email nobody uses in Bell fails with "Nobody with that email uses Bell yet", and with a real account it succeeds. So any signed-in user can find out whether an email belongs to a Bell user (`bell.share_calendar` returns `unknown_user` or `shared`). That is acceptable: everyone who can sign in was invited by the owner, and they learn nothing else about that person, so the clearer message wins over a uniform one.

## Conventions

- **Migrations** live in `supabase/migrations/NNNN_name.sql`, create objects only in the `bell` schema, and are applied by `npm run db:migrate`.
- **Types**: after a migration, `SUPABASE_PROJECT_REF=<ref> npm run db:types` regenerates `types/supabase.ts` (needs `supabase login`).
- **Edge functions** are named `bell-*` under `supabase/functions/`.
  - Each one needs an entry in `supabase/functions/secrets.json` that lists the secret names it reads. `npm run deploy:functions` refuses to deploy if a folder and the manifest disagree.
  - Deploy them with `npm run deploy:functions`, which takes the project from `SUPABASE_PROJECT_REF`.
  - Bell has no edge functions today.
