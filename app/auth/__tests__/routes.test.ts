import { GET } from '@/app/auth/callback/route';
import { POST } from '@/app/auth/signout/route';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseFake } from '@/test-utils/supabaseFake';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

const useFake = (options = {}) => {
  const { fake, client } = createSupabaseFake(options);
  vi.mocked(createClient).mockResolvedValue(client);
  return fake;
};

describe('GET /auth/callback', () => {
  it('lands an invited user on the agenda', async () => {
    const fake = useFake();

    const response = await GET(
      new Request('https://bell.test/auth/callback?code=abc&tz=Asia%2FTokyo'),
    );

    expect(response.headers.get('location')).toBe('https://bell.test/');
    expect(fake.rpc).toHaveBeenCalledWith('claim_account', {
      p_time_zone: 'Asia/Tokyo',
    });
  });

  it('sends an uninvited user back to login with a reason', async () => {
    useFake({ rpcError: { code: '42501', message: 'not invited' } });

    const response = await GET(
      new Request('https://bell.test/auth/callback?code=abc'),
    );

    expect(response.headers.get('location')).toBe(
      'https://bell.test/login?error=not-invited',
    );
  });
});

describe('POST /auth/signout', () => {
  it('signs out and returns to login', async () => {
    const fake = useFake();

    const response = await POST(new Request('https://bell.test/auth/signout'));

    expect(fake.auth.signOut).toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://bell.test/login');
  });
});
