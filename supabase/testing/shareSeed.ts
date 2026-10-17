import type { PGlite } from '@electric-sql/pglite';
import { readMigrations, runMigrations } from '@/lib/migrations';
import { saveChannel } from '@/supabase/testing/notifySeed';
import {
  MIGRATIONS_DIR,
  asMigrationDb,
  createSupabaseDb,
} from '@/supabase/testing/pglite';

export interface BellPerson {
  id: string;
  email: string;
  timeZone: string;
  phone: string;
  pushoverKey: string;
  slackTeam: string;
  slackUser: string;
}

export interface SeededPerson extends BellPerson {
  accountId: string;
  teamCalendarId: string;
  privateCalendarId: string;
}

const person = (digit: string, name: string, timeZone: string): BellPerson => ({
  id: `${digit.repeat(8)}-${digit.repeat(4)}-${digit.repeat(4)}-${digit.repeat(4)}-${digit.repeat(12)}`,
  email: `${name}@example.com`,
  timeZone,
  phone: `+1512555010${digit}`,
  pushoverKey: `${name}-pushover-key`.padEnd(30, digit),
  slackTeam: `T-${name}`,
  slackUser: `U-${name}`,
});

export const OWNER = person('1', 'owner', 'America/Chicago');
export const TEAMMATE = person('3', 'teammate', 'Europe/London');
export const OUTSIDER = person('4', 'outsider', 'Asia/Tokyo');

const insertCalendar = async (
  db: PGlite,
  who: BellPerson,
  accountId: string,
  label: string,
): Promise<string> => {
  const { rows } = await db.query<{ id: string }>(
    `insert into bell.calendars (user_id, account_id, google_calendar_id, label, color, active, sync_token, channel_id, channel_resource_id)
     values ($1, $2, $3, $4, '#0b8043', true, $5, gen_random_uuid(), $6) returning id`,
    [
      who.id,
      accountId,
      `${label.toLowerCase()}-${who.email}`,
      label,
      `sync-${who.email}`,
      `resource-${who.email}`,
    ],
  );
  return rows[0].id;
};

export const seedPerson = async (
  db: PGlite,
  who: BellPerson,
): Promise<SeededPerson> => {
  await db.query('insert into auth.users (id, email) values ($1, $2)', [
    who.id,
    who.email,
  ]);
  await db.query('insert into bell.allowlist (email) values ($1)', [who.email]);
  await db.query(
    'insert into bell.users (id, email, time_zone) values ($1, $2, $3)',
    [who.id, who.email, who.timeZone],
  );
  const account = await db.query<{ id: string }>(
    'insert into bell.accounts (user_id, google_account_id, email) values ($1, $2, $3) returning id',
    [who.id, `sub-${who.email}`, `google-${who.email}`],
  );
  const accountId = account.rows[0].id;
  await db.query(
    'insert into bell.account_secrets (account_id, refresh_token_encrypted) values ($1, $2)',
    [accountId, `v1.refresh-${who.email}`],
  );
  await db.query(
    'insert into bell.agenda_visits (user_id, seen_at) values ($1, now())',
    [who.id],
  );
  return {
    ...who,
    accountId,
    teamCalendarId: await insertCalendar(db, who, accountId, 'Team'),
    privateCalendarId: await insertCalendar(db, who, accountId, 'Private'),
  };
};

export const connectChannels = async (db: PGlite, who: BellPerson) => {
  await db.query("select bell.save_slack_install($1, $2, 'B1', $3, $4)", [
    who.slackTeam,
    `${who.slackTeam} workspace`,
    `sealed:xoxb-${who.slackTeam}`,
    who.id,
  ]);
  await saveChannel(db, who.id, ['slack'], who.slackUser, who.slackTeam);
  await saveChannel(db, who.id, ['pushover'], who.pushoverKey);
  await saveChannel(db, who.id, ['sms', 'voice'], who.phone);
  await db.query(
    "select bell.record_channel_test($1, 'pushover', true, null, now())",
    [who.id],
  );
};

export interface ShareDb {
  db: PGlite;
  owner: SeededPerson;
  teammate: SeededPerson;
  outsider: SeededPerson;
}

export const createShareDb = async (): Promise<ShareDb> => {
  const db = await createSupabaseDb();
  await runMigrations(
    asMigrationDb(db),
    await readMigrations(MIGRATIONS_DIR),
    () => undefined,
  );
  const owner = await seedPerson(db, OWNER);
  const teammate = await seedPerson(db, TEAMMATE);
  const outsider = await seedPerson(db, OUTSIDER);
  for (const who of [OWNER, TEAMMATE, OUTSIDER]) {
    await connectChannels(db, who);
  }
  return { db, owner, teammate, outsider };
};

export const addMeeting = async (
  db: PGlite,
  who: SeededPerson,
  calendarId: string,
  startsAt: Date,
  title = 'Team sync',
): Promise<string> => {
  const { rows } = await db.query<{ id: string }>(
    `insert into bell.events (user_id, calendar_id, event_id, title, starts_at, ends_at, source_tz, raw_start, status, join_url, fingerprint)
     values ($1, $2, gen_random_uuid()::text, $3, $4, $4::timestamptz + interval '30 minutes', 'America/Chicago', $4, 'confirmed', 'https://meet.google.com/abc-defg-hij', 'f')
     returning id`,
    [who.id, calendarId, title, startsAt.toISOString()],
  );
  return rows[0].id;
};

export const shareWith = async (
  db: PGlite,
  sharer: SeededPerson,
  calendarId: string,
  email: string,
): Promise<string> => {
  const { rows } = await db.query<{ share_calendar: string }>(
    'select bell.share_calendar($1, $2, $3)',
    [sharer.id, calendarId, email],
  );
  return rows[0].share_calendar;
};

export const unshare = async (
  db: PGlite,
  actor: SeededPerson,
  calendarId: string,
  sharedWith: SeededPerson,
): Promise<boolean> => {
  const { rows } = await db.query<{ unshare_calendar: boolean }>(
    'select bell.unshare_calendar($1, $2, $3)',
    [actor.id, calendarId, sharedWith.id],
  );
  return rows[0].unshare_calendar;
};

export const stepsFor = async (
  db: PGlite,
  eventId: string,
  userId: string,
): Promise<string[]> =>
  (
    await db.query<{ step: string; channel: string; result: string | null }>(
      `select step, channel, result from bell.notifications
       where event_id = $1 and user_id = $2
       order by due_at, array_position(array['slack','pushover','sms','voice'], channel)`,
      [eventId, userId],
    )
  ).rows.map((row) => `${row.step}:${row.channel}:${row.result ?? 'pending'}`);
