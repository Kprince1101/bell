import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import type { MigrationDb } from '@/lib/migrations';

export const MIGRATIONS_DIR = fileURLToPath(
  new URL('../migrations', import.meta.url),
);

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`;

export const createSupabaseDb = async (): Promise<PGlite> => {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  return db;
};

export const asMigrationDb = (db: PGlite): MigrationDb => ({
  query: (sql, params) => db.query(sql, params),
  exec: (sql) => db.exec(sql),
});

export const actAs = async (db: PGlite, userId: string): Promise<void> => {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    userId,
  ]);
};

export const actAsOwner = async (db: PGlite): Promise<void> => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
};
