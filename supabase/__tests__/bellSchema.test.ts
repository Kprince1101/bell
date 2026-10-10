import type { PGlite } from '@electric-sql/pglite';
import { NOT_INVITED_MESSAGE } from '@/lib/constants';
import { readMigrations, runMigrations } from '@/lib/migrations';
import type { Database } from '@/types/supabase';
import {
  MIGRATIONS_DIR,
  actAs,
  actAsOwner,
  asMigrationDb,
  createSupabaseDb,
} from '@/supabase/testing/pglite';

type UserRow = Database['bell']['Tables']['users']['Row'];

const INVITED = '11111111-1111-1111-1111-111111111111';
const STRANGER = '22222222-2222-2222-2222-222222222222';
const NEIGHBOUR = '33333333-3333-3333-3333-333333333333';

const EXPECTED_USER_COLUMNS = {
  id: true,
  email: true,
  time_zone: true,
  created_at: true,
  updated_at: true,
} satisfies Record<keyof UserRow, true>;

const migratedDb = async (): Promise<PGlite> => {
  const db = await createSupabaseDb();
  await runMigrations(
    asMigrationDb(db),
    await readMigrations(MIGRATIONS_DIR),
    vi.fn(),
  );
  await db.query(
    'insert into auth.users (id, email) values ($1, $2), ($3, $4), ($5, $6)',
    [
      INVITED,
      'Invited@Example.com',
      STRANGER,
      'stranger@example.com',
      NEIGHBOUR,
      'neighbour@example.com',
    ],
  );
  await db.query('insert into bell.allowlist (email) values ($1), ($2)', [
    'invited@example.com',
    'neighbour@example.com',
  ]);
  return db;
};

const claim = async (db: PGlite, userId: string, timeZone: string) => {
  await actAs(db, userId);
  const { rows } = await db.query<UserRow>(
    'select * from bell.claim_account($1)',
    [timeZone],
  );
  await actAsOwner(db);
  return rows[0];
};

const bellTables = async (db: PGlite): Promise<string[]> => {
  const { rows } = await db.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'bell' and table_type = 'BASE TABLE' order by table_name",
  );
  return rows.map((row) => row.table_name);
};

const rowsMentioning = async (
  db: PGlite,
  userId: string,
  email: string,
): Promise<number> => {
  let total = 0;
  for (const table of await bellTables(db)) {
    const { rows } = await db.query<{ hits: number }>(
      `select count(*)::int as hits from bell.${table} t where to_jsonb(t)::text ilike '%' || $1 || '%' or to_jsonb(t)::text ilike '%' || $2 || '%'`,
      [userId, email],
    );
    total += rows[0].hits;
  }
  const auth = await db.query<{ hits: number }>(
    'select count(*)::int as hits from auth.users where id = $1',
    [userId],
  );
  return total + auth.rows[0].hits;
};

describe('0001_bell', () => {
  it('creates bell.users with exactly the typed columns', async () => {
    const db = await migratedDb();
    const { rows } = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'bell' and table_name = 'users'",
    );

    expect(rows.map((row) => row.column_name).sort()).toEqual(
      Object.keys(EXPECTED_USER_COLUMNS).sort(),
    );
    expect(await bellTables(db)).toEqual(['allowlist', 'migrations', 'users']);
    await db.close();
  });

  it('creates the user row on first claim with the browser time zone', async () => {
    const db = await migratedDb();

    const user = await claim(db, INVITED, 'America/Chicago');
    const again = await claim(db, INVITED, 'Europe/Paris');

    expect(user.email).toBe('invited@example.com');
    expect(user.time_zone).toBe('America/Chicago');
    expect(again.time_zone).toBe('America/Chicago');
    await db.close();
  });

  it('falls back to UTC when the browser sends an unknown time zone', async () => {
    const db = await migratedDb();

    expect((await claim(db, INVITED, 'Mars/Olympus')).time_zone).toBe('UTC');
    await db.close();
  });

  it('refuses an email that is not on the allowlist', async () => {
    const db = await migratedDb();
    await actAs(db, STRANGER);

    await expect(
      db.query('select * from bell.claim_account($1)', ['UTC']),
    ).rejects.toThrow('not invited');
    await actAsOwner(db);
    const { rows } = await db.query('select * from bell.users');
    expect(rows).toEqual([]);
    await db.close();
  });

  it('lets a user read and retime only their own row', async () => {
    const db = await migratedDb();
    await claim(db, INVITED, 'UTC');
    await claim(db, NEIGHBOUR, 'UTC');
    await actAs(db, INVITED);

    const visible = await db.query<UserRow>('select * from bell.users');
    await db.query('update bell.users set time_zone = $1', ['Asia/Tokyo']);
    await expect(
      db.query('update bell.users set email = $1', ['x@example.com']),
    ).rejects.toThrow();
    await expect(
      db.query('update bell.users set time_zone = $1', ['Nowhere/Land']),
    ).rejects.toThrow('invalid time zone');
    await expect(db.query('select * from bell.allowlist')).rejects.toThrow();
    await actAsOwner(db);
    const { rows } = await db.query<UserRow>(
      'select id, time_zone from bell.users order by id',
    );

    expect(visible.rows.map((row) => row.id)).toEqual([INVITED]);
    expect(rows).toEqual([
      { id: INVITED, time_zone: 'Asia/Tokyo' },
      { id: NEIGHBOUR, time_zone: 'UTC' },
    ]);
    await db.close();
  });

  it('delete_me leaves nothing of the user in any bell table, including ones added later', async () => {
    const db = await migratedDb();
    await db.exec(`
      create table bell.sources (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references bell.users(id) on delete cascade,
        label text not null
      );
      create table bell.source_secrets (
        source_id uuid primary key references bell.sources(id) on delete cascade,
        token text not null
      );
      create table bell.feeds (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null,
        token text not null
      );
    `);
    await claim(db, INVITED, 'UTC');
    await claim(db, NEIGHBOUR, 'UTC');
    for (const userId of [INVITED, NEIGHBOUR]) {
      const { rows } = await db.query<{ id: string }>(
        'insert into bell.sources (user_id, label) values ($1, $2) returning id',
        [userId, 'work'],
      );
      await db.query(
        'insert into bell.source_secrets (source_id, token) values ($1, $2)',
        [rows[0].id, `secret-${userId}`],
      );
      await db.query(
        'insert into bell.feeds (user_id, token) values ($1, $2)',
        [userId, `feed-${userId}`],
      );
    }

    await actAs(db, INVITED);
    await db.query('select bell.delete_me()');
    await actAsOwner(db);
    await db.query('delete from auth.users where id = $1', [INVITED]);

    expect(await rowsMentioning(db, INVITED, 'invited@example.com')).toBe(0);
    expect(
      await rowsMentioning(db, NEIGHBOUR, 'neighbour@example.com'),
    ).toBeGreaterThan(0);
    await db.close();
  });

  it('delete_me is not callable without a signed-in user', async () => {
    const db = await migratedDb();
    await db.exec('set role anon');

    await expect(db.query('select bell.delete_me()')).rejects.toThrow();
    await db.close();
  });

  it('the signup hook admits only allowlisted emails', async () => {
    const db = await migratedDb();
    const decide = async (email: string) => {
      const { rows } = await db.query<{ result: Record<string, unknown> }>(
        'select bell.before_user_created($1::jsonb) as result',
        [JSON.stringify({ user: { email } })],
      );
      return rows[0].result;
    };

    expect(await decide('INVITED@example.com')).toEqual({});
    expect(await decide('stranger@example.com')).toEqual({
      error: { http_code: 403, message: NOT_INVITED_MESSAGE },
    });
    await db.close();
  });
});
