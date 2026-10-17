import { NextRequest } from 'next/server';
import { PUT } from '@/app/api/calendars/route';
import { DELETE } from '@/app/api/google/accounts/[accountId]/route';
import { GET as callback } from '@/app/api/google/callback/route';
import { GET as connect } from '@/app/api/google/connect/route';
import { GET as tickGet, POST as tickPost } from '@/app/api/tick/route';
import { POST as webhook } from '@/app/api/webhooks/google/route';
import { bellServices } from '@/lib/calendars/bellServices';
import { signValue } from '@/lib/crypto/tokenCipher';
import { createClient } from '@/lib/supabase/server';
import {
  ACCOUNT_ID,
  CALENDAR_ID,
  CHANNEL_ID,
  TEST_CONFIG,
  createFakeServices,
} from '@/test-utils/calendarFakes';
import { USER_ID, createSupabaseFake } from '@/test-utils/supabaseFake';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/calendars/bellServices', () => ({ bellServices: vi.fn() }));

const setup = (user: { id: string } | null = { id: USER_ID }) => {
  const fakes = createFakeServices();
  vi.mocked(bellServices).mockReturnValue(fakes.services);
  vi.mocked(createClient).mockResolvedValue(
    createSupabaseFake({ user }).client,
  );
  return fakes;
};

const pushRequest = (headers: Record<string, string>) =>
  new Request('https://bell.test/api/webhooks/google', {
    method: 'POST',
    headers,
  });

describe('POST /api/webhooks/google', () => {
  it('syncs on a verified notification and answers 200', async () => {
    const { repo } = setup(null);

    const response = await webhook(
      pushRequest({
        'X-Goog-Channel-ID': CHANNEL_ID,
        'X-Goog-Channel-Token': signValue(
          CHANNEL_ID,
          TEST_CONFIG.webhookSecret,
        ),
        'X-Goog-Resource-ID': 'resource-1',
        'X-Goog-Resource-State': 'exists',
      }),
    );

    expect(response.status).toBe(200);
    expect(repo.applySync).toHaveBeenCalledWith(CALENDAR_ID, expect.anything());
  });

  it('answers 401 to an unsigned notification', async () => {
    const { repo } = setup(null);

    const response = await webhook(
      pushRequest({
        'X-Goog-Channel-ID': CHANNEL_ID,
        'X-Goog-Resource-State': 'exists',
      }),
    );

    expect(response.status).toBe(401);
    expect(repo.calendarByChannel).not.toHaveBeenCalled();
  });
});

describe('/api/tick', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'cron-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renews channels with the cron secret', async () => {
    const { repo } = setup(null);
    const request = new Request('https://bell.test/api/tick', {
      headers: { Authorization: 'Bearer cron-secret' },
    });

    const response = await tickGet(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      channels: { renewed: [], failed: [], pushStopped: [] },
    });
    expect(repo.calendarsDueForRenewal).toHaveBeenCalled();
  });

  it('refuses without the cron secret', async () => {
    const { repo } = setup(null);

    const response = await tickPost(
      new Request('https://bell.test/api/tick', {
        method: 'POST',
        headers: { Authorization: 'Bearer wrong' },
      }),
    );

    expect(response.status).toBe(401);
    expect(repo.calendarsDueForRenewal).not.toHaveBeenCalled();
  });
});

describe('GET /api/google/connect', () => {
  it('sends the user to Google with a state cookie', async () => {
    const { google } = setup();

    const response = await connect();

    const location = new URL(response.headers.get('location') ?? '');
    const state = location.searchParams.get('state') ?? '';
    expect(response.status).toBe(307);
    expect(google.authorizeUrl).toHaveBeenCalledWith(state);
    expect(state.length).toBeGreaterThan(20);
    expect(response.headers.get('set-cookie')).toContain(
      `bell_google_state=${state}`,
    );
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  });

  it('refuses a signed-out visitor', async () => {
    setup(null);

    expect((await connect()).status).toBe(401);
  });
});

describe('GET /api/google/callback', () => {
  it('refuses a callback whose state does not match the cookie', async () => {
    const { google } = setup();
    const request = new NextRequest(
      'https://bell.test/api/google/callback?code=c&state=forged',
      { headers: { cookie: 'bell_google_state=real' } },
    );

    const response = await callback(request);

    expect(response.headers.get('location')).toBe(
      'https://bell.test/calendars?error=connect-failed',
    );
    expect(google.exchangeCode).not.toHaveBeenCalled();
  });

  it('reports a denied consent', async () => {
    setup();
    const request = new NextRequest(
      'https://bell.test/api/google/callback?error=access_denied&state=s',
      { headers: { cookie: 'bell_google_state=s' } },
    );

    expect((await callback(request)).headers.get('location')).toBe(
      'https://bell.test/calendars?error=connect-denied',
    );
  });
});

describe('PUT /api/calendars', () => {
  const put = (body: unknown) =>
    new Request('https://bell.test/api/calendars', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('saves the picked calendars for the signed-in user', async () => {
    const { repo } = setup();

    const response = await PUT(
      put({
        calendars: [
          {
            id: CALENDAR_ID,
            active: true,
            paused: true,
            label: ' Work ',
            color: '#AABBCC',
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(repo.calendarsForUser).toHaveBeenCalledWith(USER_ID);
    expect(repo.saveChoice).toHaveBeenCalledWith({
      id: CALENDAR_ID,
      active: true,
      paused: true,
      label: 'Work',
      color: '#aabbcc',
    });
  });

  it('rejects a choice without its paused state', async () => {
    const { repo } = setup();

    const response = await PUT(
      put({
        calendars: [
          { id: CALENDAR_ID, active: true, label: 'x', color: '#aabbcc' },
        ],
      }),
    );

    expect(response.status).toBe(400);
    expect(repo.saveChoice).not.toHaveBeenCalled();
  });

  it('rejects a bad color', async () => {
    const { repo } = setup();

    const response = await PUT(
      put({
        calendars: [
          {
            id: CALENDAR_ID,
            active: true,
            paused: false,
            label: 'x',
            color: 'red',
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
    expect(repo.saveChoice).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/google/accounts/[accountId]', () => {
  const context = (accountId: string) => ({
    params: Promise.resolve({ accountId }),
  });

  it('disconnects an account the user owns', async () => {
    const { repo, google } = setup();

    const response = await DELETE(
      new Request('https://bell.test/api/google/accounts/x', {
        method: 'DELETE',
      }),
      context(ACCOUNT_ID),
    );

    expect(response.status).toBe(200);
    expect(repo.accountForUser).toHaveBeenCalledWith(USER_ID, ACCOUNT_ID);
    expect(google.stopChannel).toHaveBeenCalled();
    expect(google.revokeToken).toHaveBeenCalledWith('refresh-1');
    expect(repo.deleteAccount).toHaveBeenCalledWith(ACCOUNT_ID);
  });

  it('answers 404 for an account that is not theirs', async () => {
    const { repo } = setup();
    repo.accountForUser.mockResolvedValue(null as never);

    const response = await DELETE(
      new Request('https://bell.test/api/google/accounts/x', {
        method: 'DELETE',
      }),
      context('aaaaaaaa-9999-0000-0000-000000000000'),
    );

    expect(response.status).toBe(404);
    expect(repo.deleteAccount).not.toHaveBeenCalled();
  });
});
