import { DELETE, PATCH } from '@/app/api/account/route';
import { bellServices } from '@/lib/calendars/bellServices';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { createFakeServices } from '@/test-utils/calendarFakes';
import {
  USER_ID,
  createAdminFake,
  createSupabaseFake,
} from '@/test-utils/supabaseFake';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/calendars/bellServices', () => ({ bellServices: vi.fn() }));

const jsonRequest = (method: string, body: unknown) =>
  new Request('https://bell.test/api/account', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const signedIn = (options = {}) => {
  const supabase = createSupabaseFake(options);
  const admin = createAdminFake();
  const google = createFakeServices();
  vi.mocked(createClient).mockResolvedValue(supabase.client);
  vi.mocked(createAdminClient).mockReturnValue(admin.client);
  vi.mocked(bellServices).mockReturnValue(google.services);
  return { supabase: supabase.fake, admin: admin.fake, google };
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

  it('stops channels and revokes Google tokens before wiping the account', async () => {
    const { supabase, admin, google } = signedIn();
    const order: string[] = [];
    google.google.stopChannel.mockImplementation(async () => {
      order.push('stopChannel');
    });
    google.google.revokeToken.mockImplementation(async () => {
      order.push('revokeToken');
    });
    supabase.rpc.mockImplementation(async () => {
      order.push('delete_me');
      return { data: null, error: null };
    });

    const response = await DELETE(jsonRequest('DELETE', { confirm: 'DELETE' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(order).toEqual(['stopChannel', 'revokeToken', 'delete_me']);
    expect(google.repo.accountsForUser).toHaveBeenCalledWith(USER_ID);
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it('wipes the account but keeps a login that Commander also uses', async () => {
    const { supabase, admin } = signedIn({ rpcData: false });

    const response = await DELETE(jsonRequest('DELETE', { confirm: 'DELETE' }));

    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith('delete_me');
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
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
