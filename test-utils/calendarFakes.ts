import { createBellServices } from '@/lib/calendars/services';
import type { CalendarRepo } from '@/lib/calendars/services';
import type { GoogleConfig } from '@/lib/google/config';
import type { GoogleEventsPage } from '@/lib/google/schemas';
import type { AccountRow, CalendarRow } from '@/types/calendar';
import type { GoogleGateway } from '@/types/google';
import { USER_ID } from '@/test-utils/supabaseFake';

export const NOW = new Date('2026-10-10T12:00:00.000Z');

export const TEST_CONFIG: GoogleConfig = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://bell.test/api/google/callback',
  webhookUrl: 'https://bell.test/api/webhooks/google',
  webhookSecret: 'webhook-secret-webhook-secret-webhook-secret',
};

export const ACCOUNT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
export const CALENDAR_ID = 'cccccccc-0000-0000-0000-000000000001';
export const CHANNEL_ID = 'dddddddd-0000-0000-0000-000000000001';

export const accountRow = (
  overrides: Partial<AccountRow> = {},
): AccountRow => ({
  id: ACCOUNT_ID,
  user_id: USER_ID,
  google_account_id: 'google-sub-1',
  email: 'me@gmail.com',
  created_at: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

export const calendarRow = (
  overrides: Partial<CalendarRow> = {},
): CalendarRow => ({
  id: CALENDAR_ID,
  user_id: USER_ID,
  account_id: ACCOUNT_ID,
  google_calendar_id: 'me@gmail.com',
  label: 'Personal',
  color: '#4285f4',
  time_zone: 'America/Chicago',
  sync_token: 'sync-1',
  channel_id: CHANNEL_ID,
  channel_resource_id: 'resource-1',
  channel_expires_at: '2026-10-15T12:00:00.000Z',
  active: true,
  healthy: true,
  last_sync_at: '2026-10-10T11:00:00.000Z',
  last_error: null,
  fail_count: 0,
  created_at: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

export const eventsPage = (
  overrides: Partial<GoogleEventsPage> = {},
): GoogleEventsPage => ({
  items: [],
  nextSyncToken: 'sync-2',
  timeZone: 'America/Chicago',
  ...overrides,
});

type Fake<Shape> = {
  [Key in keyof Shape]: Shape[Key] extends (...args: infer Args) => infer Out
    ? ReturnType<typeof vi.fn<(...args: Args) => Out>>
    : never;
};

export const createFakeGoogle = () => {
  const google: Fake<GoogleGateway> = {
    authorizeUrl: vi.fn<GoogleGateway['authorizeUrl']>(
      (state) => `https://accounts.test/auth?state=${state}`,
    ),
    exchangeCode: vi.fn<GoogleGateway['exchangeCode']>(async () => ({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      id_token: '',
    })),
    refreshAccessToken: vi.fn<GoogleGateway['refreshAccessToken']>(
      async () => ({ access_token: 'access-1' }),
    ),
    revokeToken: vi.fn<GoogleGateway['revokeToken']>(async () => undefined),
    listCalendars: vi.fn<GoogleGateway['listCalendars']>(async () => []),
    listEvents: vi.fn<GoogleGateway['listEvents']>(async () => eventsPage()),
    watchEvents: vi.fn<GoogleGateway['watchEvents']>(
      async (_token, _calendar, request) => ({
        id: request.id,
        resourceId: 'resource-2',
        expiration: Date.parse('2026-10-17T12:00:00.000Z'),
      }),
    ),
    stopChannel: vi.fn<GoogleGateway['stopChannel']>(async () => undefined),
  };
  return { google, gateway: google as GoogleGateway };
};

export const createFakeRepo = () => {
  const repo: Fake<CalendarRepo> = {
    accountsForUser: vi.fn<CalendarRepo['accountsForUser']>(async () => [
      accountRow(),
    ]),
    accountForUser: vi.fn<CalendarRepo['accountForUser']>(async () =>
      accountRow(),
    ),
    saveAccount: vi.fn<CalendarRepo['saveAccount']>(async () => accountRow()),
    refreshToken: vi.fn<CalendarRepo['refreshToken']>(async () => 'refresh-1'),
    saveRefreshToken: vi.fn<CalendarRepo['saveRefreshToken']>(
      async () => undefined,
    ),
    deleteAccount: vi.fn<CalendarRepo['deleteAccount']>(async () => undefined),
    saveDiscoveredCalendars: vi.fn<CalendarRepo['saveDiscoveredCalendars']>(
      async () => undefined,
    ),
    calendarsForUser: vi.fn<CalendarRepo['calendarsForUser']>(async () => [
      calendarRow(),
    ]),
    calendarsForAccount: vi.fn<CalendarRepo['calendarsForAccount']>(
      async () => [calendarRow()],
    ),
    calendarByChannel: vi.fn<CalendarRepo['calendarByChannel']>(async () =>
      calendarRow(),
    ),
    calendarsDueForRenewal: vi.fn<CalendarRepo['calendarsDueForRenewal']>(
      async () => [],
    ),
    saveChoice: vi.fn<CalendarRepo['saveChoice']>(async () => undefined),
    saveChannel: vi.fn<CalendarRepo['saveChannel']>(async () => undefined),
    clearCalendar: vi.fn<CalendarRepo['clearCalendar']>(async () => undefined),
    applySync: vi.fn<CalendarRepo['applySync']>(async () => undefined),
    recordFailure: vi.fn<CalendarRepo['recordFailure']>(async () => undefined),
    markPushStopped: vi.fn<CalendarRepo['markPushStopped']>(async () => []),
  };
  return { repo, calendarRepo: repo as CalendarRepo };
};

export const createFakeServices = () => {
  const { google, gateway } = createFakeGoogle();
  const { repo, calendarRepo } = createFakeRepo();
  const log = vi.fn();
  const services = createBellServices({
    google: gateway,
    repo: calendarRepo,
    config: () => TEST_CONFIG,
    now: () => NOW,
    log,
  });
  return { services, google, repo, log };
};
