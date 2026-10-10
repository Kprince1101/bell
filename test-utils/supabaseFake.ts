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

export const createQueryFake = (result: { data: unknown; error: unknown }) => {
  const query = {
    select: vi.fn(() => query),
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
  };
  return query;
};

export const createSupabaseFake = ({
  user = { id: USER_ID } as { id: string } | null,
  exchangeError = null as unknown,
  rpcError = null as unknown,
  row = { data: BELL_USER as unknown, error: null as unknown },
} = {}) => {
  const query = createQueryFake(row);
  const fake = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
      exchangeCodeForSession: vi.fn(async () => ({ error: exchangeError })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    rpc: vi.fn(async () => ({ data: null, error: rpcError })),
    from: vi.fn(() => query),
    query,
  };
  return { fake, client: fake as unknown as BellClient };
};

export const createAdminFake = (deleteError: unknown = null) => {
  const fake = {
    auth: {
      admin: {
        deleteUser: vi.fn(async () => ({ data: {}, error: deleteError })),
      },
    },
  };
  return { fake, client: fake as unknown as AdminClient };
};
