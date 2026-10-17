import type { PGlite } from '@electric-sql/pglite';
import type { GoogleEvent } from '@/lib/google/schemas';
import { readMigrations, runMigrations } from '@/lib/migrations';
import { sweepEnd } from '@/lib/sync/delta';
import { planDelta } from '@/lib/sync/normalize';
import {
  MIGRATIONS_DIR,
  asMigrationDb,
  createSupabaseDb,
} from '@/supabase/testing/pglite';
import { NOW } from '@/test-utils/calendarFakes';
import type { EventRow, SyncDelta } from '@/types/calendar';

export const ME = '11111111-1111-1111-1111-111111111111';
export const NEIGHBOUR = '33333333-3333-3333-3333-333333333333';
export const WINDOW_START = '2026-10-03T12:00:00.000Z';

export interface Seeded {
  db: PGlite;
  calendarId: string;
  accountId: string;
}

export const seedUser = async (db: PGlite, userId: string, email: string) => {
  await db.query('insert into auth.users (id, email) values ($1, $2)', [
    userId,
    email,
  ]);
  await db.query('insert into bell.allowlist (email) values ($1)', [email]);
  await db.query('insert into bell.users (id, email) values ($1, $2)', [
    userId,
    email,
  ]);
  const account = await db.query<{ id: string }>(
    'insert into bell.accounts (user_id, google_account_id, email) values ($1, $2, $3) returning id',
    [userId, `sub-${userId}`, email],
  );
  const accountId = account.rows[0].id;
  await db.query(
    'insert into bell.account_secrets (account_id, refresh_token_encrypted) values ($1, $2)',
    [accountId, `v1.secret-${userId}`],
  );
  const calendar = await db.query<{ id: string }>(
    `insert into bell.calendars (user_id, account_id, google_calendar_id, label, active, channel_id, channel_resource_id, channel_expires_at)
     values ($1, $2, $3, 'Work', true, gen_random_uuid(), 'res', '2026-10-15T00:00:00Z') returning id`,
    [userId, accountId, email],
  );
  return { accountId, calendarId: calendar.rows[0].id };
};

export const migratedDb = async (
  prepare: (db: PGlite) => Promise<void> = async () => undefined,
): Promise<Seeded> => {
  const db = await createSupabaseDb();
  await prepare(db);
  await runMigrations(
    asMigrationDb(db),
    await readMigrations(MIGRATIONS_DIR),
    vi.fn(),
  );
  const mine = await seedUser(db, ME, 'me@example.com');
  await seedUser(db, NEIGHBOUR, 'neighbour@example.com');
  return { db, ...mine };
};

export const delta = (
  items: GoogleEvent[],
  overrides: Partial<SyncDelta> = {},
): SyncDelta => {
  const planned = planDelta(items, 'UTC');
  return {
    mode: 'incremental',
    ...planned,
    fromSyncToken: null,
    nextSyncToken: 'sync-next',
    windowStart: WINDOW_START,
    windowEnd: sweepEnd(planned.upserts, NOW),
    seenAt: NOW.toISOString(),
    ...overrides,
  };
};

export const APPLY_SYNC =
  'select bell.apply_sync($1, $2, $3, $4, $5, $6, $7, $8, $9) as applied';

export const applyFrom = async (
  db: PGlite,
  calendarId: string,
  change: SyncDelta,
) =>
  (
    await db.query<{ applied: boolean }>(APPLY_SYNC, [
      calendarId,
      JSON.stringify(change.upserts),
      change.cancelled,
      change.fromSyncToken,
      change.nextSyncToken,
      change.mode === 'full',
      change.windowStart,
      change.windowEnd,
      change.seenAt,
    ])
  ).rows[0].applied;

export const storedToken = async (db: PGlite, calendarId: string) =>
  (
    await db.query<{ sync_token: string | null }>(
      'select sync_token from bell.calendars where id = $1',
      [calendarId],
    )
  ).rows[0]?.sync_token ?? null;

export const applySync = async (
  db: PGlite,
  calendarId: string,
  change: SyncDelta,
) =>
  applyFrom(db, calendarId, {
    ...change,
    fromSyncToken: await storedToken(db, calendarId),
  });

export const events = async (db: PGlite, calendarId: string) =>
  (
    await db.query<EventRow>(
      'select * from bell.events where calendar_id = $1 order by event_id',
      [calendarId],
    )
  ).rows;
