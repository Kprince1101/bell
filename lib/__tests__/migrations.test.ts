import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  pendingMigrations,
  readMigrations,
  runMigrations,
} from '@/lib/migrations';
import {
  MIGRATIONS_DIR,
  asMigrationDb,
  createSupabaseDb,
} from '@/supabase/testing/pglite';

describe('pendingMigrations', () => {
  it('keeps only the migrations not yet recorded, in order', () => {
    const migrations = [
      { name: '0001_a.sql', sql: '' },
      { name: '0002_b.sql', sql: '' },
      { name: '0003_c.sql', sql: '' },
    ];

    expect(
      pendingMigrations(migrations, ['0001_a.sql']).map((m) => m.name),
    ).toEqual(['0002_b.sql', '0003_c.sql']);
  });
});

describe('readMigrations', () => {
  it('reads numbered sql files in order and skips everything else', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bell-migrations-'));
    await writeFile(join(dir, '0002_second.sql'), 'select 2;');
    await writeFile(join(dir, '0001_first.sql'), 'select 1;');
    await writeFile(join(dir, 'README.md'), 'not a migration');

    expect(await readMigrations(dir)).toEqual([
      { name: '0001_first.sql', sql: 'select 1;' },
      { name: '0002_second.sql', sql: 'select 2;' },
    ]);
  });
});

describe('runMigrations', () => {
  it('applies every repo migration once and records it in bell.migrations', async () => {
    const db = await createSupabaseDb();
    const migrations = await readMigrations(MIGRATIONS_DIR);
    const log = vi.fn();

    const first = await runMigrations(asMigrationDb(db), migrations, log);
    const second = await runMigrations(asMigrationDb(db), migrations, log);
    const recorded = await db.query<{ name: string }>(
      'select name from bell.migrations order by name',
    );

    expect(first).toEqual(migrations.map((m) => m.name));
    expect(second).toEqual([]);
    expect(recorded.rows.map((row) => row.name)).toEqual(first);
    expect(log).toHaveBeenCalledWith('applied 0001_bell.sql');
    await db.close();
  });

  it('rolls back a failing migration and records nothing for it', async () => {
    const db = await createSupabaseDb();
    const migrations = await readMigrations(MIGRATIONS_DIR);
    const broken = { name: '9999_broken.sql', sql: 'create table bell.x (' };

    await expect(
      runMigrations(asMigrationDb(db), [...migrations, broken], vi.fn()),
    ).rejects.toThrow();
    const recorded = await db.query<{ name: string }>(
      'select name from bell.migrations order by name',
    );

    expect(recorded.rows.map((row) => row.name)).toEqual(
      migrations.map((m) => m.name),
    );
    await db.close();
  });
});
