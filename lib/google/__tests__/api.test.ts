import { GOOGLE_CALENDAR_SCOPES, createGoogleGateway } from '@/lib/google/api';
import { getGoogleConfig } from '@/lib/google/config';
import { GoogleApiError } from '@/lib/google/errors';
import { TEST_CONFIG } from '@/test-utils/calendarFakes';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const gatewayWith = (...responses: Response[]) => {
  const fetchImpl = vi.fn<typeof fetch>();
  responses.forEach((response) => fetchImpl.mockResolvedValueOnce(response));
  return {
    fetchImpl,
    google: createGoogleGateway(() => TEST_CONFIG, fetchImpl),
  };
};

const calledUrl = (fetchImpl: ReturnType<typeof vi.fn>, index = 0) =>
  new URL(String(fetchImpl.mock.calls[index][0]));

describe('createGoogleGateway', () => {
  it('asks for offline calendar read access with the given state', () => {
    const { google } = gatewayWith();

    const url = new URL(google.authorizeUrl('state-1'));

    expect(url.origin + url.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(url.searchParams.get('scope')).toBe(
      GOOGLE_CALENDAR_SCOPES.join(' '),
    );
    expect(GOOGLE_CALENDAR_SCOPES).toContain(
      'https://www.googleapis.com/auth/calendar.readonly',
    );
    expect(GOOGLE_CALENDAR_SCOPES).toContain(
      'https://www.googleapis.com/auth/calendar.events.readonly',
    );
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('redirect_uri')).toBe(TEST_CONFIG.redirectUri);
    expect(url.searchParams.get('state')).toBe('state-1');
  });

  it('exchanges the code at the token endpoint with the client secret in the body', async () => {
    const { fetchImpl, google } = gatewayWith(
      json(200, { access_token: 'a', refresh_token: 'r', id_token: 'i' }),
    );

    expect(await google.exchangeCode('code-1')).toMatchObject({
      refresh_token: 'r',
    });
    const [url, init] = fetchImpl.mock.calls[0];
    const body = new URLSearchParams(String(init?.body));
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('client_secret')).toBe('client-secret');
    expect(body.get('redirect_uri')).toBe(TEST_CONFIG.redirectUri);
  });

  it('lists single event instances with the sync token', async () => {
    const { fetchImpl, google } = gatewayWith(
      json(200, { items: [{ id: 'e1' }], nextSyncToken: 's2' }),
    );

    const page = await google.listEvents('access', 'team@client.com', {
      syncToken: 's1',
    });

    const url = calledUrl(fetchImpl);
    expect(url.pathname).toBe(
      '/calendar/v3/calendars/team%40client.com/events',
    );
    expect(url.searchParams.get('singleEvents')).toBe('true');
    expect(url.searchParams.get('syncToken')).toBe('s1');
    expect(url.searchParams.has('timeMin')).toBe(false);
    expect(fetchImpl.mock.calls[0][1]?.headers).toEqual({
      Authorization: 'Bearer access',
    });
    expect(page).toEqual({ items: [{ id: 'e1' }], nextSyncToken: 's2' });
  });

  it('raises a 410 as a GoogleApiError the sync can recognize', async () => {
    const { google } = gatewayWith(
      json(410, {
        error: { code: 410, message: 'Sync token is no longer valid' },
      }),
    );

    const error = await google
      .listEvents('access', 'c', { syncToken: 'old' })
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(GoogleApiError);
    expect(error).toMatchObject({
      status: 410,
      message: 'Google 410: Sync token is no longer valid',
    });
  });

  it('registers a web_hook channel with a TTL and reads the expiry', async () => {
    const { fetchImpl, google } = gatewayWith(
      json(200, { id: 'ch', resourceId: 'res', expiration: '1791720000000' }),
    );

    const watch = await google.watchEvents('access', 'primary', {
      id: 'ch',
      token: 'tok',
      address: TEST_CONFIG.webhookUrl,
      ttlSeconds: 604800,
    });

    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({
      id: 'ch',
      type: 'web_hook',
      address: TEST_CONFIG.webhookUrl,
      token: 'tok',
      params: { ttl: '604800' },
    });
    expect(watch).toEqual({
      id: 'ch',
      resourceId: 'res',
      expiration: 1791720000000,
    });
  });

  it('pages through the calendar list', async () => {
    const { fetchImpl, google } = gatewayWith(
      json(200, { items: [{ id: 'a' }], nextPageToken: 'p2' }),
      json(200, { items: [{ id: 'b' }] }),
    );

    const calendars = await google.listCalendars('access');

    expect(calendars.map((calendar) => calendar.id)).toEqual(['a', 'b']);
    expect(calledUrl(fetchImpl, 1).searchParams.get('pageToken')).toBe('p2');
  });

  it('stops channels and revokes tokens', async () => {
    const { fetchImpl, google } = gatewayWith(
      new Response(null, { status: 204 }),
      json(200, {}),
    );

    await google.stopChannel('access', { id: 'ch', resourceId: 'res' });
    await google.revokeToken('refresh');

    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://www.googleapis.com/calendar/v3/channels/stop',
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({
      id: 'ch',
      resourceId: 'res',
    });
    expect(fetchImpl.mock.calls[1][0]).toBe(
      'https://oauth2.googleapis.com/revoke',
    );
  });

  it('reports OAuth errors by their description', async () => {
    const { google } = gatewayWith(
      json(400, {
        error: 'invalid_grant',
        error_description: 'Token has been expired or revoked.',
      }),
    );

    await expect(google.refreshAccessToken('r')).rejects.toThrow(
      'Google 400: Token has been expired or revoked.',
    );
  });
});

describe('getGoogleConfig', () => {
  it('derives the callback and webhook URLs from the app URL', () => {
    expect(
      getGoogleConfig({
        GOOGLE_CLIENT_ID: 'id',
        GOOGLE_CLIENT_SECRET: 'secret',
        BELL_APP_URL: 'https://bell.dontpanic.fyi',
        BELL_WEBHOOK_SECRET: 'x'.repeat(32),
      }),
    ).toEqual({
      clientId: 'id',
      clientSecret: 'secret',
      redirectUri: 'https://bell.dontpanic.fyi/api/google/callback',
      webhookUrl: 'https://bell.dontpanic.fyi/api/webhooks/google',
      webhookSecret: 'x'.repeat(32),
    });
  });

  it('names the missing settings without echoing values', () => {
    expect(() => getGoogleConfig({ GOOGLE_CLIENT_SECRET: 'hunter2' })).toThrow(
      /GOOGLE_CLIENT_ID.*BELL_WEBHOOK_SECRET/,
    );
    expect(() =>
      getGoogleConfig({ GOOGLE_CLIENT_SECRET: 'hunter2' }),
    ).not.toThrow(/hunter2/);
  });
});
