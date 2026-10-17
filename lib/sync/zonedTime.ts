import { resolveTimeZone } from '@/lib/timeZone';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const zoneParts = (instant: number, timeZone: string): Map<string, number> => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(instant));
  return new Map(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
};

const offsetMs = (instant: number, timeZone: string): number => {
  const parts = zoneParts(instant, timeZone);
  const wallClock = Date.UTC(
    parts.get('year') ?? 0,
    (parts.get('month') ?? 1) - 1,
    parts.get('day') ?? 1,
    parts.get('hour') ?? 0,
    parts.get('minute') ?? 0,
    parts.get('second') ?? 0,
  );
  return wallClock - Math.floor(instant / 1000) * 1000;
};

export const zonedMidnightToUtc = (date: string, timeZone: string): string => {
  const zone = resolveTimeZone(timeZone);
  const [year, month, day] = date.split('-').map(Number);
  const wallClock = Date.UTC(year, month - 1, day);
  const firstGuess = wallClock - offsetMs(wallClock, zone);
  const settled = wallClock - offsetMs(firstGuess, zone);
  return new Date(settled).toISOString();
};

export const toUtcIso = (value: string): string =>
  new Date(value).toISOString();

export const shiftDays = (instant: Date, days: number): Date =>
  new Date(instant.getTime() + days * DAY_MS);
