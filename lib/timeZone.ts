export const DEFAULT_TIME_ZONE = 'UTC';

export const isValidTimeZone = (candidate: string): boolean => {
  if (!candidate) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate });
    return true;
  } catch {
    return false;
  }
};

export const resolveTimeZone = (
  candidate: string | null | undefined,
): string => {
  if (candidate && isValidTimeZone(candidate)) return candidate;
  return DEFAULT_TIME_ZONE;
};

export const browserTimeZone = (): string =>
  resolveTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);

export const listTimeZones = (): string[] => {
  const zones = Intl.supportedValuesOf('timeZone');
  if (zones.includes(DEFAULT_TIME_ZONE)) return zones;
  return [DEFAULT_TIME_ZONE, ...zones];
};
