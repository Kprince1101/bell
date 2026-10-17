import { GENERIC_ERROR_MESSAGE } from '@/lib/constants';
import type { CalendarChoice } from '@/types/calendar';

interface CalendarsApiResponse {
  error?: string;
}

const send = async (
  url: string,
  init: RequestInit,
): Promise<CalendarsApiResponse> => {
  const response = await fetch(url, init);
  const payload: CalendarsApiResponse = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? GENERIC_ERROR_MESSAGE);
  return payload;
};

export const saveCalendarChoices = async (
  calendars: CalendarChoice[],
): Promise<void> => {
  await send('/api/calendars', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ calendars }),
  });
};

export const disconnectGoogleAccount = async (
  accountId: string,
): Promise<void> => {
  await send(`/api/google/accounts/${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
  });
};
