import type { z } from 'zod';
import type { GoogleConfig } from '@/lib/google/config';
import { GoogleApiError } from '@/lib/google/errors';
import {
  googleCalendarListPage,
  googleErrorBody,
  googleEventsPage,
  googleTokenResponse,
  googleWatchResponse,
} from '@/lib/google/schemas';
import type { GoogleCalendarListEntry } from '@/lib/google/schemas';
import type { EventsQuery, GoogleGateway } from '@/types/google';

export const GOOGLE_CALENDAR_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
];

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const EVENTS_PAGE_SIZE = '2500';
const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded' };

type Fetch = typeof fetch;

const describeError = (status: number, raw: unknown): string => {
  const parsed = googleErrorBody.safeParse(raw);
  const error = parsed.data?.error;
  if (typeof error === 'object' && error.message) {
    return `Google ${status}: ${error.message}`;
  }
  const detail = parsed.data?.error_description ?? error;
  if (typeof detail === 'string') return `Google ${status}: ${detail}`;
  return `Google ${status}`;
};

const request = async (
  fetchImpl: Fetch,
  url: string,
  init: RequestInit,
): Promise<unknown> => {
  const response = await fetchImpl(url, init);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new GoogleApiError(
      response.status,
      describeError(response.status, body),
    );
  }
  return body;
};

const parse = <Schema extends z.ZodType>(
  schema: Schema,
  body: unknown,
): z.infer<Schema> => {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new GoogleApiError(502, 'Google returned an unexpected response');
  }
  return parsed.data;
};

const bearer = (accessToken: string): Record<string, string> => ({
  Authorization: `Bearer ${accessToken}`,
});

const calendarPath = (calendarId: string): string =>
  `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}`;

const eventsSearch = (query: EventsQuery): string => {
  const params = new URLSearchParams({
    singleEvents: 'true',
    maxResults: EVENTS_PAGE_SIZE,
  });
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
};

export const createGoogleGateway = (
  config: () => GoogleConfig,
  fetchImpl: Fetch = fetch,
): GoogleGateway => {
  const tokenRequest = async (form: Record<string, string>) =>
    parse(
      googleTokenResponse,
      await request(fetchImpl, TOKEN_URL, {
        method: 'POST',
        headers: FORM_HEADERS,
        body: new URLSearchParams({
          client_id: config().clientId,
          client_secret: config().clientSecret,
          ...form,
        }),
      }),
    );

  return {
    authorizeUrl: (state) => {
      const url = new URL(AUTHORIZE_URL);
      url.search = new URLSearchParams({
        client_id: config().clientId,
        redirect_uri: config().redirectUri,
        response_type: 'code',
        scope: GOOGLE_CALENDAR_SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent select_account',
        include_granted_scopes: 'true',
        state,
      }).toString();
      return url.toString();
    },

    exchangeCode: (code) =>
      tokenRequest({
        code,
        grant_type: 'authorization_code',
        redirect_uri: config().redirectUri,
      }),

    refreshAccessToken: (refreshToken) =>
      tokenRequest({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),

    revokeToken: async (token) => {
      await request(fetchImpl, REVOKE_URL, {
        method: 'POST',
        headers: FORM_HEADERS,
        body: new URLSearchParams({ token }),
      });
    },

    listCalendars: async (accessToken) => {
      const entries: GoogleCalendarListEntry[] = [];
      let pageToken: string | undefined;
      do {
        const params = new URLSearchParams({ minAccessRole: 'reader' });
        if (pageToken) params.set('pageToken', pageToken);
        const page = parse(
          googleCalendarListPage,
          await request(
            fetchImpl,
            `${CALENDAR_API}/users/me/calendarList?${params}`,
            { headers: bearer(accessToken) },
          ),
        );
        entries.push(...page.items);
        pageToken = page.nextPageToken;
      } while (pageToken);
      return entries;
    },

    listEvents: async (accessToken, calendarId, query) =>
      parse(
        googleEventsPage,
        await request(
          fetchImpl,
          `${calendarPath(calendarId)}/events?${eventsSearch(query)}`,
          { headers: bearer(accessToken) },
        ),
      ),

    watchEvents: async (accessToken, calendarId, watch) =>
      parse(
        googleWatchResponse,
        await request(fetchImpl, `${calendarPath(calendarId)}/events/watch`, {
          method: 'POST',
          headers: {
            ...bearer(accessToken),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: watch.id,
            type: 'web_hook',
            address: watch.address,
            token: watch.token,
            params: { ttl: String(watch.ttlSeconds) },
          }),
        }),
      ),

    stopChannel: async (accessToken, channel) => {
      await request(fetchImpl, `${CALENDAR_API}/channels/stop`, {
        method: 'POST',
        headers: { ...bearer(accessToken), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: channel.id,
          resourceId: channel.resourceId,
        }),
      });
    },
  };
};
