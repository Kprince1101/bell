import type { CalendarHealth, CalendarRow } from '@/types/calendar';

export const SYNC_FAILURE_LIMIT = 3;

type HealthFields = Pick<
  CalendarRow,
  'active' | 'healthy' | 'last_error' | 'last_sync_at' | 'fail_count'
>;

export const channelHealthAfterRenewal = (
  calendar: Pick<CalendarRow, 'fail_count' | 'last_error'>,
): Pick<CalendarRow, 'healthy' | 'last_error'> => {
  if (calendar.fail_count === 0) return { healthy: true, last_error: null };
  return {
    healthy: calendar.fail_count < SYNC_FAILURE_LIMIT,
    last_error: calendar.last_error,
  };
};

const formatSyncedAt = (iso: string, timeZone: string): string =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));

export const describeHealth = (
  calendar: HealthFields,
  timeZone: string,
): CalendarHealth => {
  if (!calendar.active) return { tone: 'off', text: 'Not included' };
  if (!calendar.healthy) {
    return {
      tone: 'unhealthy',
      text: `Unhealthy: ${calendar.last_error ?? 'sync is failing'}`,
    };
  }
  if (!calendar.last_sync_at) {
    return { tone: 'healthy', text: 'Waiting for first sync' };
  }
  return {
    tone: 'healthy',
    text: `Last synced ${formatSyncedAt(calendar.last_sync_at, timeZone)}`,
  };
};

type DetailFields = Pick<
  CalendarRow,
  'active' | 'paused' | 'last_sync_at' | 'channel_expires_at' | 'last_error'
>;

const syncDetail = (calendar: DetailFields, timeZone: string): string => {
  if (!calendar.last_sync_at) return 'Last sync: never';
  return `Last sync: ${formatSyncedAt(calendar.last_sync_at, timeZone)}`;
};

const channelDetail = (calendar: DetailFields, timeZone: string): string => {
  if (!calendar.channel_expires_at) return 'Push channel: none';
  return `Push channel expires: ${formatSyncedAt(calendar.channel_expires_at, timeZone)}`;
};

export const healthDetails = (
  calendar: DetailFields,
  timeZone: string,
): string[] => {
  if (!calendar.active) return [];
  const details = [
    syncDetail(calendar, timeZone),
    channelDetail(calendar, timeZone),
  ];
  if (calendar.last_error) details.push(`Last error: ${calendar.last_error}`);
  if (calendar.paused) details.push('Paused: hidden from the agenda');
  return details;
};

export const isUnhealthy = (
  calendar: Pick<CalendarRow, 'active' | 'healthy'>,
) => calendar.active && !calendar.healthy;
