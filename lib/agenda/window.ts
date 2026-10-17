import { AGENDA_DAYS, DAY_MS } from '@/lib/constants';
import { zonedMidnightToUtc } from '@/lib/sync/zonedTime';
import { resolveTimeZone } from '@/lib/timeZone';
import type { AgendaWindow } from '@/types/agenda';

const datePart = (parts: Intl.DateTimeFormatPart[], type: string): string =>
  parts.find((part) => part.type === type)?.value ?? '';

export const localDateKey = (
  instant: string | Date,
  timeZone: string,
): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  return `${datePart(parts, 'year')}-${datePart(parts, 'month')}-${datePart(parts, 'day')}`;
};

export const addDaysToKey = (dateKey: string, days: number): string =>
  new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);

export const agendaWindow = (
  now: Date,
  timeZone: string,
  days: number = AGENDA_DAYS,
): AgendaWindow => {
  const zone = resolveTimeZone(timeZone);
  const todayKey = localDateKey(now, zone);
  const from = zonedMidnightToUtc(todayKey, zone);
  const to = zonedMidnightToUtc(addDaysToKey(todayKey, days), zone);
  return {
    from,
    to,
    todayKey,
    dayKeys: Array.from({ length: days }, (_, index) =>
      addDaysToKey(todayKey, index),
    ),
    query: {
      from: new Date(Date.parse(from) - DAY_MS).toISOString(),
      to: new Date(Date.parse(to) + DAY_MS).toISOString(),
    },
  };
};
