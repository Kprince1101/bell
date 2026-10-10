import { jsonRequest, sendJson } from '@/lib/apiClient';
import type { CalendarChoice } from '@/types/calendar';

export const saveCalendarChoices = async (
  calendars: CalendarChoice[],
): Promise<void> => {
  await sendJson('/api/calendars', jsonRequest('PUT', { calendars }));
};

export const disconnectGoogleAccount = async (
  accountId: string,
): Promise<void> => {
  await sendJson(`/api/google/accounts/${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
  });
};
