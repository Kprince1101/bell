import type { PGlite } from '@electric-sql/pglite';
import { readMigrations, runMigrations } from '@/lib/migrations';
import {
  MIGRATIONS_DIR,
  asMigrationDb,
  createSupabaseDb,
} from '@/supabase/testing/pglite';
import type { ChannelKind } from '@/types/notifications';

export const ME = '11111111-1111-1111-1111-111111111111';
export const NEIGHBOUR = '33333333-3333-3333-3333-333333333333';
export const PUSHOVER_KEY = 'u'.repeat(30);
export const PHONE = '+15125550100';
export const SLACK_USER = 'U1';
export const SLACK_TEAM = 'T1';

export const MINUTE = 60_000;

export const thisMinute = (): Date =>
  new Date(Math.floor(Date.now() / MINUTE) * MINUTE);

export const plusMinutes = (base: Date, minutes: number): Date =>
  new Date(base.getTime() + minutes * MINUTE);

export interface NotifyDb {
  db: PGlite;
  calendarId: string;
}

const seedUser = async (db: PGlite, userId: string, email: string) => {
  await db.query('insert into auth.users (id, email) values ($1, $2)', [
    userId,
    email,
  ]);
  await db.query('insert into bell.allowlist (email) values ($1)', [email]);
  await db.query(
    "insert into bell.users (id, email, time_zone) values ($1, $2, 'America/Chicago')",
    [userId, email],
  );
  const account = await db.query<{ id: string }>(
    'insert into bell.accounts (user_id, google_account_id, email) values ($1, $2, $3) returning id',
    [userId, `sub-${userId}`, email],
  );
  const calendar = await db.query<{ id: string }>(
    `insert into bell.calendars (user_id, account_id, google_calendar_id, label, active)
     values ($1, $2, $3, 'Work', true) returning id`,
    [userId, account.rows[0].id, email],
  );
  return calendar.rows[0].id;
};

export const saveChannel = async (
  db: PGlite,
  userId: string,
  kinds: ChannelKind[],
  value: string,
  slackTeamId: string | null = null,
) => {
  await db.query('select bell.save_channel_secret($1, $2, $3, $4, $5)', [
    userId,
    kinds,
    value,
    'hint',
    slackTeamId,
  ]);
};

export const connectEveryChannel = async (db: PGlite, userId: string) => {
  await db.query(
    "select bell.save_slack_install($1, 'Toptal', 'B1', 'sealed:xoxb-1', $2)",
    [SLACK_TEAM, userId],
  );
  await saveChannel(db, userId, ['slack'], SLACK_USER, SLACK_TEAM);
  await saveChannel(db, userId, ['pushover'], PUSHOVER_KEY);
  await saveChannel(db, userId, ['sms', 'voice'], PHONE);
};

export const createNotifyDb = async (): Promise<NotifyDb> => {
  const db = await createSupabaseDb();
  await runMigrations(
    asMigrationDb(db),
    await readMigrations(MIGRATIONS_DIR),
    () => undefined,
  );
  const calendarId = await seedUser(db, ME, 'me@example.com');
  await seedUser(db, NEIGHBOUR, 'neighbour@example.com');
  return { db, calendarId };
};

export interface EventSeed {
  startsAt: Date;
  title?: string;
  allDay?: boolean;
  status?: string;
  sourceTz?: string;
}

export const addEvent = async (
  db: PGlite,
  calendarId: string,
  {
    startsAt,
    title = 'Client sync',
    allDay = false,
    status = 'confirmed',
    sourceTz = 'America/Los_Angeles',
  }: EventSeed,
): Promise<string> => {
  const { rows } = await db.query<{ id: string }>(
    `insert into bell.events (user_id, calendar_id, event_id, title, starts_at, ends_at, source_tz, raw_start, all_day, status, join_url, fingerprint)
     values ($1, $2, gen_random_uuid()::text, $3, $4, $4::timestamptz + interval '30 minutes', $5, $4, $6, $7, 'https://meet.google.com/abc-defg-hij', 'f')
     returning id`,
    [ME, calendarId, title, startsAt.toISOString(), sourceTz, allDay, status],
  );
  return rows[0].id;
};

export interface NotificationRow {
  step: string;
  channel: string;
  result: string | null;
  error: string | null;
  sent_at: Date | null;
  claimed_at: Date | null;
  due_at: Date;
  acknowledged_at: Date | null;
  acknowledged_by: string | null;
  fallback_for: string | null;
  provider_ref: string | null;
}

export const notificationsFor = async (
  db: PGlite,
  eventId: string,
): Promise<NotificationRow[]> =>
  (
    await db.query<NotificationRow>(
      `select * from bell.notifications where event_id = $1
       order by due_at, array_position(array['slack','pushover','sms','voice'], channel)`,
      [eventId],
    )
  ).rows;

export const stepsOf = (rows: NotificationRow[]) =>
  rows.map((row) => `${row.step}:${row.channel}:${row.result ?? 'pending'}`);
