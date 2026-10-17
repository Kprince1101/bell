import { GET } from '@/app/api/health/route';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { fullEnv, greenReport } from '@/test-utils/healthFixtures';
import { USER_ID, createSupabaseFake } from '@/test-utils/supabaseFake';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));

const setup = (user: { id: string } | null, { owner = true } = {}) => {
  const rpc = vi.fn(async () => ({ data: greenReport(), error: null }));
  vi.mocked(createAdminClient).mockReturnValue({
    rpc,
  } as unknown as ReturnType<typeof createAdminClient>);
  const session = createSupabaseFake({ user, rpcData: owner });
  vi.mocked(createClient).mockResolvedValue(session.client);
  return { rpc, session: session.fake };
};

beforeEach(() => {
  Object.entries(fullEnv()).forEach(([name, value]) => vi.stubEnv(name, value));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/health', () => {
  it('refuses a signed-out visitor', async () => {
    const { rpc } = setup(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuses a signed-in member who is not an owner on the Invites list', async () => {
    const { rpc, session } = setup({ id: USER_ID }, { owner: false });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(session.rpc).toHaveBeenCalledWith('is_owner');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('gives the owner the panel for their own channels and calendars', async () => {
    const { rpc } = setup({ id: USER_ID });

    const response = await GET();
    const panel = await response.json();

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('health_report', { p_user_id: USER_ID });
    expect(
      panel.sections.map((section: { key: string }) => section.key),
    ).toEqual([
      'scheduler',
      'jobs',
      'notifications',
      'channels',
      'sources',
      'secrets',
    ]);
    expect(JSON.stringify(panel)).not.toContain('configured');
  });

  it('hides a database error behind the generic message', async () => {
    const { rpc } = setup({ id: USER_ID });
    rpc.mockResolvedValue({
      data: null,
      error: new Error('relation "cron.job" does not exist'),
    } as never);
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const response = await GET();

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('cron');
    expect(consoleError).toHaveBeenCalled();
  });
});
