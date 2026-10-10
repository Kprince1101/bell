import type {
  GoogleCalendarListEntry,
  GoogleEventsPage,
  GoogleTokenResponse,
  GoogleWatchResponse,
} from '@/lib/google/schemas';

export interface EventsQuery {
  syncToken?: string;
  timeMin?: string;
  timeMax?: string;
  pageToken?: string;
}

export interface WatchRequest {
  id: string;
  token: string;
  address: string;
  ttlSeconds: number;
}

export interface ChannelRef {
  id: string;
  resourceId: string;
}

export interface GoogleGateway {
  authorizeUrl: (state: string) => string;
  exchangeCode: (code: string) => Promise<GoogleTokenResponse>;
  refreshAccessToken: (refreshToken: string) => Promise<GoogleTokenResponse>;
  revokeToken: (token: string) => Promise<void>;
  listCalendars: (accessToken: string) => Promise<GoogleCalendarListEntry[]>;
  listEvents: (
    accessToken: string,
    calendarId: string,
    query: EventsQuery,
  ) => Promise<GoogleEventsPage>;
  watchEvents: (
    accessToken: string,
    calendarId: string,
    request: WatchRequest,
  ) => Promise<GoogleWatchResponse>;
  stopChannel: (accessToken: string, channel: ChannelRef) => Promise<void>;
}
