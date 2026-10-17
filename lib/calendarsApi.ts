import { jsonRequest, sendJson } from '@/lib/apiClient';
import type { CalendarChoice } from '@/types/calendar';

export const saveCalendarChoices = async (
  calendars: CalendarChoice[],
): Promise<void> => {
  await sendJson('/api/calendars', jsonRequest('PUT', { calendars }));
};

export const CALENDAR_SHARES_PATH = '/api/calendars/shares';

export const shareCalendar = async (
  calendarId: string,
  email: string,
): Promise<void> => {
  await sendJson(
    CALENDAR_SHARES_PATH,
    jsonRequest('POST', { calendarId, email }),
  );
};

export const removeCalendarShare = async (
  calendarId: string,
  sharedWithUserId: string,
): Promise<void> => {
  await sendJson(
    CALENDAR_SHARES_PATH,
    jsonRequest('DELETE', { calendarId, sharedWithUserId }),
  );
};

export const disconnectGoogleAccount = async (
  accountId: string,
): Promise<void> => {
  await sendJson(`/api/google/accounts/${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
  });
};
