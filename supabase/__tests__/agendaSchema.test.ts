import type { PGlite } from '@electric-sql/pglite';
import {
  ME,
  NEIGHBOUR,
  applySync,
  delta,
  events,
  migratedDb,
} from '@/supabase/testing/calendarSeed';
import { actAs, actAsOwner } from '@/supabase/testing/pglite';
import {
  CLIENT_REVIEW_ET,
  OFFSITE,
  STANDUP,
  STANDUP_DELETED,
  STANDUP_MOVED,
} from '@/test-utils/googleFixtures';

const firstSync = async (db: PGlite, calendarId: string) =>
  applySync(db, calendarId, delta([STANDUP, OFFSITE], { mode: 'full' }));

const byId = async (db: PGlite, calendarId: string, eventId: string) =>
  (await events(db, calendarId)).find((row) => row.event_id === eventId);

describe('0003_agenda change tracking', () => {
  it('marks nothing during a calendar’s first sync', async () => {
    const { db, calendarId } = await migratedDb();

    await firstSync(db, calendarId);

    expect((await events(db, calendarId)).map((row) => row.changed_at)).toEqual(
      [null, null],
    );
    await db.close();
  });

  it('stamps an event that arrives after the first sync as new, keeping its zone', async () => {
    const { db, calendarId } = await migratedDb();
    await firstSync(db, calendarId);

    await applySync(db, calendarId, delta([CLIENT_REVIEW_ET]));

    const review = await byId(db, calendarId, 'client-review');
    expect(review?.changed_at).not.toBeNull();
    expect(review?.previous_starts_at).toBeNull();
    expect(review?.source_tz).toBe('America/New_York');
    await db.close();
  });

  it('remembers the old start of a moved event', async () => {
    const { db, calendarId } = await migratedDb();
    await firstSync(db, calendarId);

    await applySync(db, calendarId, delta([STANDUP_MOVED]));

    const standup = await byId(db, calendarId, 'standup');
    expect(standup?.changed_at).not.toBeNull();
    expect(new Date(standup?.previous_starts_at ?? '').toISOString()).toBe(
      '2026-10-12T14:00:00.000Z',
    );
    await db.close();
  });

  it('stamps a cancellation, and an unchanged resend stamps nothing', async () => {
    const { db, calendarId } = await migratedDb();
    await firstSync(db, calendarId);

    await applySync(db, calendarId, delta([STANDUP, OFFSITE]));
    expect((await events(db, calendarId)).map((row) => row.changed_at)).toEqual(
      [null, null],
    );

    await applySync(db, calendarId, delta([STANDUP_DELETED]));
    const standup = await byId(db, calendarId, 'standup');
    expect(standup?.status).toBe('cancelled');
    expect(standup?.changed_at).not.toBeNull();
    await db.close();
  });

  it('defaults calendars to not paused', async () => {
    const { db, calendarId } = await migratedDb();

    const { rows } = await db.query<{ paused: boolean }>(
      'select paused from bell.calendars where id = $1',
      [calendarId],
    );

    expect(rows[0].paused).toBe(false);
    await db.close();
  });
});

describe('0003_agenda visits', () => {
  it('lets a user keep only their own agenda visit', async () => {
    const { db } = await migratedDb();
    await actAs(db, ME);

    await db.query(
      `insert into bell.agenda_visits (user_id, seen_at) values ($1, now())
       on conflict (user_id) do update set seen_at = excluded.seen_at, baseline_at = excluded.baseline_at`,
      [ME],
    );
    await db.query(
      `insert into bell.agenda_visits (user_id, seen_at) values ($1, now())
       on conflict (user_id) do update set seen_at = excluded.seen_at`,
      [ME],
    );
    await expect(
      db.query(
        'insert into bell.agenda_visits (user_id, seen_at) values ($1, now())',
        [NEIGHBOUR],
      ),
    ).rejects.toThrow();
    await actAsOwner(db);
    await db.query(
      'insert into bell.agenda_visits (user_id, seen_at) values ($1, now())',
      [NEIGHBOUR],
    );
    await actAs(db, ME);
    const visible = await db.query<{ user_id: string }>(
      'select user_id from bell.agenda_visits',
    );
    await actAsOwner(db);

    expect(visible.rows).toEqual([{ user_id: ME }]);
    await db.close();
  });

  it('does not let a user pause a calendar directly', async () => {
    const { db } = await migratedDb();
    await actAs(db, ME);

    await expect(
      db.query('update bell.calendars set paused = true'),
    ).rejects.toThrow();
    await actAsOwner(db);
    await db.close();
  });

  it('delete_me removes the agenda visit too', async () => {
    const { db } = await migratedDb();
    await db.query(
      'insert into bell.agenda_visits (user_id, seen_at) values ($1, now())',
      [ME],
    );
    await actAs(db, ME);

    await db.query('select bell.delete_me()');
    await actAsOwner(db);

    const { rows } = await db.query<{ n: number }>(
      'select count(*)::int as n from bell.agenda_visits where user_id = $1',
      [ME],
    );
    expect(rows[0].n).toBe(0);
    await db.close();
  });
});

describe('0003_agenda realtime', () => {
  it('publishes bell.events to Supabase realtime when the publication exists', async () => {
    const { db } = await migratedDb(async (fresh) => {
      await fresh.exec('create publication supabase_realtime');
    });

    const { rows } = await db.query<{ tablename: string }>(
      "select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'bell'",
    );

    expect(rows).toEqual([{ tablename: 'events' }]);
    await db.close();
  });

  it('still migrates where there is no realtime publication', async () => {
    const { db } = await migratedDb();

    const { rows } = await db.query(
      "select 1 from pg_publication where pubname = 'supabase_realtime'",
    );

    expect(rows).toEqual([]);
    await db.close();
  });
});
