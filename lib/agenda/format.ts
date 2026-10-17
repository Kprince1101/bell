import { addDaysToKey } from '@/lib/agenda/window';
import { isValidTimeZone, resolveTimeZone } from '@/lib/timeZone';

type ZoneNameStyle = 'short' | 'shortGeneric' | 'longOffset';

const COMPACT_ZONE = /^[A-Z]{1,5}$/;
const OFFSET = /GMT([+-])(\d{2}):(\d{2})/;

const zoneName = (
  instant: string,
  timeZone: string,
  style: ZoneNameStyle,
): string =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timeZone),
    timeZoneName: style,
  })
    .formatToParts(new Date(instant))
    .find((part) => part.type === 'timeZoneName')?.value ?? timeZone;

export const formatClock = (instant: string, timeZone: string): string =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timeZone),
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(instant));

export const formatWeekday = (instant: string, timeZone: string): string =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timeZone),
    weekday: 'short',
  }).format(new Date(instant));

export const zoneLabel = (instant: string, timeZone: string): string => {
  const generic = zoneName(instant, timeZone, 'shortGeneric');
  if (COMPACT_ZONE.test(generic)) return generic;
  return zoneName(instant, timeZone, 'short');
};

export const offsetMinutes = (instant: string, timeZone: string): number => {
  const match = OFFSET.exec(zoneName(instant, timeZone, 'longOffset'));
  if (!match) return 0;
  const sign = Number(`${match[1]}1`);
  return sign * (Number(match[2]) * 60 + Number(match[3]));
};

export const zonesDiffer = (
  instant: string,
  userTimeZone: string,
  sourceTimeZone: string | null,
): boolean => {
  if (!sourceTimeZone || !isValidTimeZone(sourceTimeZone)) return false;
  return (
    offsetMinutes(instant, sourceTimeZone) !==
    offsetMinutes(instant, userTimeZone)
  );
};

export const formatDayLabel = (dateKey: string, todayKey: string): string => {
  if (dateKey === todayKey) return 'Today';
  if (dateKey === addDaysToKey(todayKey, 1)) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dateKey}T00:00:00Z`));
};

const pad = (value: number): string => String(value).padStart(2, '0');

export const formatCountdown = (remainingMs: number): string => {
  if (remainingMs <= 0) return 'Starting now';
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `in ${days}d ${hours}h ${pad(minutes)}m`;
  if (hours > 0) return `in ${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  if (minutes > 0) return `in ${minutes}m ${pad(seconds)}s`;
  return `in ${seconds}s`;
};
