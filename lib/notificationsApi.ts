import { jsonRequest, sendJson } from '@/lib/apiClient';
import type { ChannelKind } from '@/types/notifications';

export const savePushoverKey = async (key: string): Promise<void> => {
  await sendJson('/api/channels/pushover', jsonRequest('PUT', { key }));
};

export const savePhoneNumber = async (number: string): Promise<void> => {
  await sendJson('/api/channels/phone', jsonRequest('PUT', { number }));
};

export const setChannelActive = async (
  kind: ChannelKind,
  active: boolean,
): Promise<void> => {
  await sendJson('/api/channels', jsonRequest('PATCH', { kind, active }));
};

export const testChannel = async (kind: ChannelKind): Promise<void> => {
  await sendJson('/api/channels/test', jsonRequest('POST', { kind }));
};

export const setCalendarQuiet = async (
  calendarId: string,
  quiet: boolean,
): Promise<void> => {
  await sendJson(
    '/api/calendars/quiet',
    jsonRequest('PUT', { calendarId, quiet }),
  );
};

export const acknowledgeEvent = async (eventId: string): Promise<void> => {
  await sendJson('/api/notifications/ack', jsonRequest('POST', { eventId }));
};
