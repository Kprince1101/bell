import type { Database } from '@/types/supabase';

type BellTables = Database['bell']['Tables'];

export type AccountRow = BellTables['accounts']['Row'];
export type CalendarRow = BellTables['calendars']['Row'];
export type EventRow = BellTables['events']['Row'];

export type EventStatus = 'tentative' | 'confirmed' | 'cancelled';
export type SyncMode = 'full' | 'incremental';
export type SyncTrigger = 'connect' | 'webhook';

export interface EventAttendee {
  email: string | null;
  name: string | null;
  response: string | null;
  optional: boolean;
  organizer: boolean;
  self: boolean;
}

export interface SyncedEvent {
  event_id: string;
  recurring_event_id: string | null;
  instance_at: string | null;
  title: string;
  location: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string;
  source_tz: string | null;
  raw_start: string;
  all_day: boolean;
  status: EventStatus;
  organizer: string | null;
  attendees: EventAttendee[];
  join_url: string | null;
  fingerprint: string;
}

export interface SyncDelta {
  mode: SyncMode;
  upserts: SyncedEvent[];
  cancelled: string[];
  nextSyncToken: string;
  windowStart: string;
  seenAt: string;
}

export interface SyncWindow {
  timeMin: string;
  timeMax: string;
}

export interface CalendarChannel {
  channelId: string;
  resourceId: string;
  expiresAt: string;
}

export interface NewAccount {
  userId: string;
  googleAccountId: string;
  email: string;
  refreshToken: string;
}

export interface DiscoveredCalendar {
  googleCalendarId: string;
  label: string;
  color: string | null;
  timeZone: string | null;
}

export interface CalendarChoice {
  id: string;
  active: boolean;
  paused: boolean;
  label: string;
  color: string;
}

export type CalendarHealthTone = 'healthy' | 'unhealthy' | 'off';

export interface CalendarHealth {
  tone: CalendarHealthTone;
  text: string;
}

export interface CalendarView {
  choice: CalendarChoice;
  googleCalendarId: string;
  health: CalendarHealth;
  details: string[];
}

export interface AccountView {
  id: string;
  email: string;
  calendars: CalendarView[];
}

export interface CalendarsClientProps {
  accounts: AccountView[];
  error: string | null;
  notice: string | null;
}
