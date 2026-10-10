import {
  connectGoogleAccount,
  toDiscoveredCalendar,
} from '@/lib/calendars/connect';
import { completeGoogleConnect } from '@/lib/calendars/oauth';
import { accountRow, createFakeServices } from '@/test-utils/calendarFakes';
import { USER_ID } from '@/test-utils/supabaseFake';

const idToken = (claims: Record<string, unknown>) =>
  [
    'header',
    Buffer.from(JSON.stringify(claims)).toString('base64url'),
    'signature',
  ].join('.');

const WORK = {
  id: 'team@client.com',
  summary: 'Client team',
  backgroundColor: '#16A765',
  timeZone: 'Europe/Paris',
};

const signedInGoogle = () => {
  const fakes = createFakeServices();
  fakes.google.exchangeCode.mockResolvedValue({
    access_token: 'access-1',
    refresh_token: 'refresh-1',
    id_token: idToken({ sub: 'google-sub-1', email: 'Me@Gmail.com' }),
  });
  fakes.google.listCalendars.mockResolvedValue([WORK] as never);
  return fakes;
};

describe('connectGoogleAccount', () => {
  it('stores the account and its refresh token, then lists its calendars', async () => {
    const { services, google, repo } = signedInGoogle();

    const account = await connectGoogleAccount(services, USER_ID, 'code-1');

    expect(google.exchangeCode).toHaveBeenCalledWith('code-1');
    expect(repo.saveAccount).toHaveBeenCalledWith({
      userId: USER_ID,
      googleAccountId: 'google-sub-1',
      email: 'me@gmail.com',
      refreshToken: 'refresh-1',
    });
    expect(google.listCalendars).toHaveBeenCalledWith('access-1');
    expect(repo.saveDiscoveredCalendars).toHaveBeenCalledWith(accountRow(), [
      {
        googleCalendarId: 'team@client.com',
        label: 'Client team',
        color: '#16a765',
        timeZone: 'Europe/Paris',
      },
    ]);
    expect(account).toEqual(accountRow());
    expect(google.listEvents).not.toHaveBeenCalled();
  });

  it('refuses a grant without a refresh token', async () => {
    const { services, google, repo } = signedInGoogle();
    google.exchangeCode.mockResolvedValue({
      access_token: 'a',
      id_token: '',
    } as never);

    await expect(connectGoogleAccount(services, USER_ID, 'c')).rejects.toThrow(
      'refresh token',
    );
    expect(repo.saveAccount).not.toHaveBeenCalled();
  });
});

describe('toDiscoveredCalendar', () => {
  it('prefers the user override and drops colors that are not plain hex', () => {
    expect(
      toDiscoveredCalendar({
        id: 'x',
        summary: 'Raw',
        summaryOverride: 'Mine',
        backgroundColor: 'blue',
      }),
    ).toEqual({
      googleCalendarId: 'x',
      label: 'Mine',
      color: null,
      timeZone: null,
    });
  });
});

describe('completeGoogleConnect', () => {
  const callback = (overrides = {}) => ({
    userId: USER_ID,
    code: 'code-1',
    state: 'state-1',
    expectedState: 'state-1',
    error: null,
    ...overrides,
  });

  it('connects when the state matches', async () => {
    const { services } = signedInGoogle();

    expect(await completeGoogleConnect(services, callback())).toBe('connected');
  });

  it('refuses a mismatched or missing state', async () => {
    const { services, google } = signedInGoogle();

    expect(
      await completeGoogleConnect(services, callback({ state: 'forged' })),
    ).toBe('failed');
    expect(
      await completeGoogleConnect(
        services,
        callback({ expectedState: undefined }),
      ),
    ).toBe('failed');
    expect(google.exchangeCode).not.toHaveBeenCalled();
  });

  it('reports a denied consent', async () => {
    const { services } = signedInGoogle();

    expect(
      await completeGoogleConnect(
        services,
        callback({ error: 'access_denied' }),
      ),
    ).toBe('denied');
  });

  it('turns a failed exchange into a failed outcome', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { services, google } = signedInGoogle();
    google.exchangeCode.mockRejectedValue(new Error('invalid_grant'));

    expect(await completeGoogleConnect(services, callback())).toBe('failed');
  });
});
