import { DELETE, PATCH } from '@/app/api/account/route';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  USER_ID,
  createAdminFake,
  createSupabaseFake,
} from '@/test-utils/supabaseFake';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));

const jsonRequest = (method: string, body: unknown) =>
  new Request('https://bell.test/api/account', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const signedIn = (options = {}) => {
  const supabase = createSupabaseFake(options);
  const admin = createAdminFake();
  vi.mocked(createClient).mockResolvedValue(supabase.client);
  vi.mocked(createAdminClient).mockReturnValue(admin.client);
  return { supabase: supabase.fake, admin: admin.fake };
};

describe('DELETE /api/account', () => {
  it('refuses without a signed-in user', async () => {
    const { supabase } = signedIn({ user: null });

    const response = await DELETE(jsonRequest('DELETE', { confirm: 'DELETE' }));

    expect(response.status).toBe(401);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('refuses unless the body says DELETE', async () => {
    const { supabase, admin } = signedIn();

    const response = await DELETE(jsonRequest('DELETE', { confirm: 'delete' }));

    expect(response.status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('wipes the account and the auth user', async () => {
    const { supabase, admin } = signedIn();

    const response = await DELETE(jsonRequest('DELETE', { confirm: 'DELETE' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(supabase.rpc).toHaveBeenCalledWith('delete_me');
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it('hides database errors behind a generic message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    signedIn({ rpcError: new Error('relation bell.x does not exist') });

    const response = await DELETE(jsonRequest('DELETE', { confirm: 'DELETE' }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Something went wrong. Please try again.',
    });
  });
});

describe('PATCH /api/account', () => {
  it('saves a valid time zone', async () => {
    const { supabase } = signedIn();

    const response = await PATCH(
      jsonRequest('PATCH', { timeZone: 'America/Chicago' }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ timeZone: 'America/Chicago' });
    expect(supabase.query.update).toHaveBeenCalledWith({
      time_zone: 'America/Chicago',
    });
  });

  it('rejects an unknown time zone', async () => {
    const { supabase } = signedIn();

    const response = await PATCH(
      jsonRequest('PATCH', { timeZone: 'Mars/Olympus' }),
    );

    expect(response.status).toBe(400);
    expect(supabase.query.update).not.toHaveBeenCalled();
  });
});
