export const STALE_AFTER_MS = 5 * 60_000;

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const ageMs = (at: string, now: Date): number =>
  now.getTime() - new Date(at).getTime();

export const isStale = (
  at: string | null,
  now: Date,
  limit: number = STALE_AFTER_MS,
): boolean => {
  if (!at) return true;
  return ageMs(at, now) > limit;
};

export const isPast = (at: string | null, now: Date): boolean => {
  if (!at) return true;
  return new Date(at).getTime() <= now.getTime();
};

export const formatAge = (at: string, now: Date): string => {
  const age = Math.max(0, ageMs(at, now));
  if (age < MINUTE) return `${Math.floor(age / SECOND)}s ago`;
  if (age < HOUR) return `${Math.floor(age / MINUTE)} min ago`;
  if (age < 2 * DAY) return `${Math.floor(age / HOUR)} h ago`;
  return `${Math.floor(age / DAY)} days ago`;
};
