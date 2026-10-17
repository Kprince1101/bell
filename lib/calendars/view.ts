import {
  describeHealth,
  healthDetails,
  isUnhealthy,
} from '@/lib/calendars/health';
import {
  CALENDAR_ERROR_MESSAGES,
  CALENDAR_NOTICE_MESSAGES,
} from '@/lib/constants';
import type { BellClient } from '@/lib/supabase/server';
import type {
  AccountRow,
  AccountView,
  CalendarRow,
  CalendarView,
} from '@/types/calendar';

export interface CalendarsSearchParams {
  error?: string;
  notice?: string;
}

const toCalendarView = (
  calendar: CalendarRow,
  timeZone: string,
): CalendarView => ({
  choice: {
    id: calendar.id,
    active: calendar.active,
    paused: calendar.paused,
    label: calendar.label,
    color: calendar.color,
  },
  googleCalendarId: calendar.google_calendar_id,
  health: describeHealth(calendar, timeZone),
  details: healthDetails(calendar, timeZone),
});

export const buildCalendarsView = (
  accounts: AccountRow[],
  calendars: CalendarRow[],
  timeZone: string,
): AccountView[] =>
  accounts.map((account) => ({
    id: account.id,
    email: account.email,
    calendars: calendars
      .filter((calendar) => calendar.account_id === account.id)
      .map((calendar) => toCalendarView(calendar, timeZone)),
  }));

export const loadCalendarsView = async (
  supabase: BellClient,
  timeZone: string,
): Promise<AccountView[]> => {
  const [accounts, calendars] = await Promise.all([
    supabase.from('accounts').select('*').order('created_at'),
    supabase.from('calendars').select('*').order('label'),
  ]);
  if (accounts.error) throw accounts.error;
  if (calendars.error) throw calendars.error;
  return buildCalendarsView(accounts.data, calendars.data, timeZone);
};

export const countUnhealthyCalendars = async (
  supabase: BellClient,
): Promise<number> => {
  const { data, error } = await supabase
    .from('calendars')
    .select('active, healthy')
    .eq('active', true);
  if (error) throw error;
  return data.filter(isUnhealthy).length;
};

export const unhealthyMessage = (count: number): string | null => {
  if (count === 0) return null;
  if (count === 1) return '1 calendar is unhealthy and may be out of date.';
  return `${count} calendars are unhealthy and may be out of date.`;
};

export const resolveCalendarMessages = ({
  error,
  notice,
}: CalendarsSearchParams) => ({
  error: CALENDAR_ERROR_MESSAGES[error ?? ''] ?? null,
  notice: CALENDAR_NOTICE_MESSAGES[notice ?? ''] ?? null,
});
