import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface Migration {
  name: string;
  sql: string;
}

export interface MigrationDb {
  query: <Row>(sql: string, params?: unknown[]) => Promise<{ rows: Row[] }>;
  exec: (sql: string) => Promise<unknown>;
}

export const MIGRATION_FILE = /^\d{4}_[a-z0-9_]+\.sql$/;

export const readMigrations = async (dir: string): Promise<Migration[]> => {
  const names = (await readdir(dir))
    .filter((name) => MIGRATION_FILE.test(name))
    .sort();
  return Promise.all(
    names.map(async (name) => ({
      name,
      sql: await readFile(join(dir, name), 'utf8'),
    })),
  );
};

export const pendingMigrations = (
  migrations: Migration[],
  applied: string[],
): Migration[] => {
  const done = new Set(applied);
  return migrations.filter((migration) => !done.has(migration.name));
};

export const appliedMigrations = async (db: MigrationDb): Promise<string[]> => {
  const { rows } = await db.query<{ present: boolean }>(
    "select to_regclass('bell.migrations') is not null as present",
  );
  if (!rows[0]?.present) return [];
  const applied = await db.query<{ name: string }>(
    'select name from bell.migrations order by name',
  );
  return applied.rows.map((row) => row.name);
};

const applyMigration = async (
  db: MigrationDb,
  migration: Migration,
): Promise<void> => {
  await db.exec('begin');
  try {
    await db.exec(migration.sql);
    await db.query('insert into bell.migrations (name) values ($1)', [
      migration.name,
    ]);
    await db.exec('commit');
  } catch (err) {
    await db.exec('rollback');
    throw err;
  }
};

export const runMigrations = async (
  db: MigrationDb,
  migrations: Migration[],
  log: (line: string) => void = console.log,
): Promise<string[]> => {
  const pending = pendingMigrations(migrations, await appliedMigrations(db));
  for (const migration of pending) {
    await applyMigration(db, migration);
    log(`applied ${migration.name}`);
  }
  return pending.map((migration) => migration.name);
};
