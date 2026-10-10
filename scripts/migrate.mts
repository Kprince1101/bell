import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { readMigrations, runMigrations } from '../lib/migrations.ts';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  const migrations = await readMigrations(
    fileURLToPath(new URL('../supabase/migrations', import.meta.url)),
  );
  const applied = await runMigrations(
    {
      query: async <Row,>(sql: string, params?: unknown[]) => {
        const result = await client.query(sql, params);
        return { rows: result.rows as Row[] };
      },
      exec: (sql) => client.query(sql),
    },
    migrations,
  );
  console.log(`${applied.length} migration(s) applied.`);
} finally {
  await client.end();
}
