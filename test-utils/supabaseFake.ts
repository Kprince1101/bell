import type { AdminClient } from '@/lib/account';
import type { BellClient } from '@/lib/supabase/server';

export const USER_ID = '11111111-1111-1111-1111-111111111111';

export const BELL_USER = {
  id: USER_ID,
  email: 'invited@example.com',
  time_zone: 'America/Chicago',
  created_at: '2026-10-10T00:00:00Z',
  updated_at: '2026-10-10T00:00:00Z',
};

export const INVITES = [
  {
    email: 'owner@example.com',
    role: 'owner',
    added_at: '2026-10-10T00:00:00Z',
  },
];

interface Result {
  data: unknown;
  error: unknown;
}

export const createQueryFake = (row: Result, list: Result) => {
  const query = {
    select: vi.fn(() => query),
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn(async () => row),
    maybeSingle: vi.fn(async () => row),
    order: vi.fn(async () => list),
  };
  return query;
};

export const createSupabaseFake = ({
  user = { id: USER_ID } as { id: string } | null,
  exchangeError = null as unknown,
  rpcData = true as unknown,
  rpcError = null as unknown,
  row = { data: BELL_USER as unknown, error: null as unknown },
  list = { data: INVITES as unknown, error: null as unknown },
} = {}) => {
  const query = createQueryFake(row, list);
  const fake = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
      exchangeCodeForSession: vi.fn(async () => ({ error: exchangeError })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    rpc: vi.fn(async (_name: string) => ({ data: rpcData, error: rpcError })),
    from: vi.fn(() => query),
    query,
  };
  return { fake, client: fake as unknown as BellClient };
};

export const createAdminFake = ({
  deleteError = null as unknown,
  createError = null as unknown,
  upsertError = null as unknown,
} = {}) => {
  const allowlist = {
    upsert: vi.fn(async () => ({ data: null, error: upsertError })),
  };
  const fake = {
    auth: {
      admin: {
        deleteUser: vi.fn(async () => ({ data: {}, error: deleteError })),
        createUser: vi.fn(async () => ({
          data: { user: null },
          error: createError,
        })),
      },
    },
    from: vi.fn(() => allowlist),
    allowlist,
  };
  return { fake, client: fake as unknown as AdminClient };
};
