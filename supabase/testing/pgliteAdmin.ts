import type { PGlite } from '@electric-sql/pglite';
import type { AdminClient } from '@/lib/account';

type RpcArgs = Record<string, unknown>;

const unwrapRow = (fn: string, row: Record<string, unknown>): unknown => {
  const keys = Object.keys(row);
  if (keys.length === 1 && keys[0] === fn) return row[fn];
  return row;
};

const returnsSet = async (db: PGlite, fn: string): Promise<boolean> => {
  const { rows } = await db.query<{ proretset: boolean }>(
    `select p.proretset from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'bell' and p.proname = $1`,
    [fn],
  );
  return rows[0]?.proretset ?? false;
};

export const createPgliteAdmin = (db: PGlite): AdminClient => {
  const rpc = async (fn: string, args: RpcArgs = {}) => {
    const names = Object.keys(args).filter((key) => args[key] !== undefined);
    const call = names.map((name, index) => `${name} => $${index + 1}`);
    try {
      const { rows } = await db.query<Record<string, unknown>>(
        `select * from bell.${fn}(${call.join(', ')})`,
        names.map((name) => args[name]),
      );
      const values = rows.map((row) => unwrapRow(fn, row));
      if (await returnsSet(db, fn)) return { data: values, error: null };
      return { data: values[0] ?? null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };
  return { rpc } as unknown as AdminClient;
};
