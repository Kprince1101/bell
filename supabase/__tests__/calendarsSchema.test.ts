import type { PGlite } from '@electric-sql/pglite';
import { readMigrations, runMigrations } from '@/lib/migrations';
import { planDelta } from '@/lib/sync/normalize';
import {
  MIGRATIONS_DIR,
  actAs,
  actAsOwner,
  asMigrationDb,
  createSupabaseDb,
} from '@/supabase/testing/pglite';
import type { EventRow, SyncDelta } from '@/types/calendar';
import type { GoogleEvent } from '@/lib/google/schemas';
import {
  OFFSITE,
  STANDUP,
  STANDUP_DELETED,
  STANDUP_MOVED,
  WEEKLY_INSTANCE,
  WEEKLY_SERIES_DELETED,
} from '@/test-utils/googleFixtures';

const ME = '11111111-1111-1111-1111-111111111111';
const NEIGHBOUR = '33333333-3333-3333-3333-333333333333';
const WINDOW_START = '2026-10-03T12:00:00.000Z';

interface Seeded {
  db: PGlite;
  calendarId: string;
  accountId: string;
}

const seedUser = async (db: PGlite, userId: string, email: string) => {
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

const migratedDb = async (): Promise<Seeded> => {
  const db = await createSupabaseDb();
  await runMigrations(
    asMigrationDb(db),
    await readMigrations(MIGRATIONS_DIR),
    vi.fn(),
  );
  const mine = await seedUser(db, ME, 'me@example.com');
  await seedUser(db, NEIGHBOUR, 'neighbour@example.com');
  return { db, ...mine };
};

const delta = (
  items: GoogleEvent[],
  overrides: Partial<SyncDelta> = {},
): SyncDelta => ({
  mode: 'incremental',
  ...planDelta(items, 'UTC'),
  nextSyncToken: 'sync-next',
  windowStart: WINDOW_START,
  seenAt: '2026-10-10T12:00:00.000Z',
  ...overrides,
});

const applySync = async (db: PGlite, calendarId: string, change: SyncDelta) => {
  await db.query('select bell.apply_sync($1, $2, $3, $4, $5, $6, $7)', [
    calendarId,
    JSON.stringify(change.upserts),
    change.cancelled,
    change.nextSyncToken,
    change.mode === 'full',
    change.windowStart,
    change.seenAt,
  ]);
};

const events = async (db: PGlite, calendarId: string) =>
  (
    await db.query<EventRow>(
      'select * from bell.events where calendar_id = $1 order by event_id',
      [calendarId],
    )
  ).rows;

const calendar = async (db: PGlite, calendarId: string) =>
  (
    await db.query<{
      sync_token: string | null;
      fail_count: number;
      healthy: boolean;
      last_error: string | null;
      last_sync_at: Date | null;
    }>('select * from bell.calendars where id = $1', [calendarId])
  ).rows[0];

describe('0002_google_calendars apply_sync', () => {
  it('stores what changed and the new sync token', async () => {
    const { db, calendarId } = await migratedDb();

    await applySync(
      db,
      calendarId,
      delta([STANDUP, OFFSITE], { mode: 'full' }),
    );

    const rows = await events(db, calendarId);
    expect(rows.map((row) => [row.event_id, row.status])).toEqual([
      ['offsite', 'tentative'],
      ['standup', 'confirmed'],
    ]);
    expect(rows[1]).toMatchObject({
      user_id: ME,
      title: 'Standup',
      source_tz: 'America/Chicago',
      raw_start: '2026-10-12T09:00:00-05:00',
      join_url: 'https://meet.google.com/abc-defg-hij',
      organizer: 'boss@client.com',
    });
    expect(new Date(rows[1].starts_at).toISOString()).toBe(
      '2026-10-12T14:00:00.000Z',
    );
    expect(rows[1].attendees).toHaveLength(2);
    expect(await calendar(db, calendarId)).toMatchObject({
      sync_token: 'sync-next',
      fail_count: 0,
      healthy: true,
    });
    await db.close();
  });

  it('is idempotent: the same delta twice leaves the same rows', async () => {
    const { db, calendarId } = await migratedDb();

    await applySync(db, calendarId, delta([STANDUP, OFFSITE]));
    const first = await events(db, calendarId);
    await applySync(db, calendarId, delta([STANDUP, OFFSITE]));
    const second = await events(db, calendarId);

    expect(second).toEqual(first);
    await db.close();
  });

  it('updates a moved event in place with a new fingerprint', async () => {
    const { db, calendarId } = await migratedDb();
    await applySync(db, calendarId, delta([STANDUP]));
    const [before] = await events(db, calendarId);

    await applySync(
      db,
      calendarId,
      delta([STANDUP_MOVED], { nextSyncToken: 'sync-3' }),
    );
    const [after] = await events(db, calendarId);

    expect(after.id).toBe(before.id);
    expect(new Date(after.starts_at).toISOString()).toBe(
      '2026-10-12T15:00:00.000Z',
    );
    expect(after.fingerprint).not.toBe(before.fingerprint);
    expect((await calendar(db, calendarId)).sync_token).toBe('sync-3');
    await db.close();
  });

  it('marks deleted events and whole deleted series cancelled instead of dropping them', async () => {
    const { db, calendarId } = await migratedDb();
    await applySync(db, calendarId, delta([STANDUP, WEEKLY_INSTANCE, OFFSITE]));

    await applySync(
      db,
      calendarId,
      delta([STANDUP_DELETED, WEEKLY_SERIES_DELETED]),
    );

    expect(
      (await events(db, calendarId)).map((row) => [row.event_id, row.status]),
    ).toEqual([
      ['offsite', 'tentative'],
      ['standup', 'cancelled'],
      ['weekly_20261015T140000Z', 'cancelled'],
    ]);
    await db.close();
  });

  it('a full resync cancels in-window events Google no longer returns', async () => {
    const { db, calendarId } = await migratedDb();
    await applySync(
      db,
      calendarId,
      delta([STANDUP, OFFSITE], {
        seenAt: '2026-10-09T12:00:00.000Z',
      }),
    );

    await applySync(
      db,
      calendarId,
      delta([OFFSITE], { mode: 'full', nextSyncToken: 'fresh' }),
    );

    expect(
      (await events(db, calendarId)).map((row) => [row.event_id, row.status]),
    ).toEqual([
      ['offsite', 'tentative'],
      ['standup', 'cancelled'],
    ]);
    await db.close();
  });

  it('refuses an unknown calendar', async () => {
    const { db } = await migratedDb();

    await expect(
      applySync(db, '99999999-9999-9999-9999-999999999999', delta([STANDUP])),
    ).rejects.toThrow('unknown calendar');
    await db.close();
  });
});

describe('0002_google_calendars health', () => {
  it('marks a calendar unhealthy on the third failure and a good sync heals it', async () => {
    const { db, calendarId } = await migratedDb();
    const fail = (message: string) =>
      db.query('select bell.record_sync_failure($1, $2)', [
        calendarId,
        message,
      ]);

    await fail('Google 500');
    await fail('Google 500');
    expect(await calendar(db, calendarId)).toMatchObject({
      fail_count: 2,
      healthy: true,
    });
    await fail('Google 503: Backend Error');
    expect(await calendar(db, calendarId)).toMatchObject({
      fail_count: 3,
      healthy: false,
      last_error: 'Google 503: Backend Error',
    });

    await applySync(db, calendarId, delta([STANDUP]));
    expect(await calendar(db, calendarId)).toMatchObject({
      fail_count: 0,
      healthy: true,
      last_error: null,
    });
    await db.close();
  });

  it('marks active calendars whose push channel is gone or expired', async () => {
    const { db, calendarId } = await migratedDb();

    const before = await db.query<{ id: string }>(
      'select * from bell.mark_push_stopped($1)',
      ['2026-10-10T00:00:00Z'],
    );
    const after = await db.query<{ mark_push_stopped: string }>(
      'select * from bell.mark_push_stopped($1)',
      ['2026-10-16T00:00:00Z'],
    );

    expect(before.rows).toHaveLength(0);
    expect(after.rows).toHaveLength(2);
    expect(await calendar(db, calendarId)).toMatchObject({
      healthy: false,
      last_error:
        'Push notifications stopped: the watch channel is missing or expired.',
    });
    await db.close();
  });
});

describe('0002_google_calendars access', () => {
  it('lets a user read only their own accounts, calendars and events', async () => {
    const { db, calendarId } = await migratedDb();
    await applySync(db, calendarId, delta([STANDUP]));
    await actAs(db, NEIGHBOUR);

    const accounts = await db.query('select * from bell.accounts');
    const calendars = await db.query('select * from bell.calendars');
    const visible = await db.query('select * from bell.events');

    expect(accounts.rows).toHaveLength(1);
    expect(calendars.rows).toHaveLength(1);
    expect(visible.rows).toHaveLength(0);
    await actAsOwner(db);
    await db.close();
  });

  it('never lets a signed-in user read refresh tokens or write sync state', async () => {
    const { db, calendarId } = await migratedDb();
    await actAs(db, ME);

    await expect(
      db.query('select * from bell.account_secrets'),
    ).rejects.toThrow();
    await expect(
      db.query("update bell.calendars set sync_token = 'x'"),
    ).rejects.toThrow();
    await expect(
      db.query('select bell.apply_sync($1, $2, $3, $4, $5, $6, $7)', [
        calendarId,
        '[]',
        [],
        't',
        false,
        WINDOW_START,
        WINDOW_START,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query('select bell.record_sync_failure($1, $2)', [calendarId, 'x']),
    ).rejects.toThrow();
    await actAsOwner(db);
    await db.close();
  });

  it('removing an account removes its secret, calendars and events', async () => {
    const { db, calendarId, accountId } = await migratedDb();
    await applySync(db, calendarId, delta([STANDUP]));

    await db.query('delete from bell.accounts where id = $1', [accountId]);

    const counts = await db.query<{ t: string; n: number }>(
      `select 'secrets' as t, count(*)::int as n from bell.account_secrets where account_id = $1
       union all select 'calendars', count(*)::int from bell.calendars where account_id = $1
       union all select 'events', count(*)::int from bell.events where calendar_id = $2`,
      [accountId, calendarId],
    );
    expect(counts.rows.map((row) => row.n)).toEqual([0, 0, 0]);
    await db.close();
  });

  it.each([
    ['a Bell-only user', false],
    ['a user who keeps a Commander profile', true],
  ])(
    'delete_me leaves no account, secret, calendar or event of %s',
    async (_who, hasProfile) => {
      const { db, calendarId, accountId } = await migratedDb();
      await db.exec(
        'create table public.profiles (user_id uuid primary key references auth.users(id))',
      );
      if (hasProfile) {
        await db.query('insert into public.profiles (user_id) values ($1)', [
          ME,
        ]);
      }
      await applySync(db, calendarId, delta([STANDUP, OFFSITE]));
      await actAs(db, ME);

      const removable = await db.query<{ delete_me: boolean }>(
        'select bell.delete_me()',
      );
      await actAsOwner(db);

      expect(removable.rows[0].delete_me).toBe(!hasProfile);

      const counts = await db.query<{ n: number }>(
        `select count(*)::int as n from bell.account_secrets where account_id = $1
       union all select count(*)::int from bell.accounts where user_id = $2
       union all select count(*)::int from bell.calendars where user_id = $2
       union all select count(*)::int from bell.events where user_id = $2`,
        [accountId, ME],
      );
      const neighbour = await db.query<{ n: number }>(
        'select count(*)::int as n from bell.calendars where user_id = $1',
        [NEIGHBOUR],
      );
      expect(counts.rows.map((row) => row.n)).toEqual([0, 0, 0, 0]);
      expect(neighbour.rows[0].n).toBe(1);
      await db.close();
    },
  );
});
