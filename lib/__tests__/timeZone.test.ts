import {
  DEFAULT_TIME_ZONE,
  isValidTimeZone,
  listTimeZones,
  resolveTimeZone,
} from '@/lib/timeZone';

describe('timeZone', () => {
  it('accepts IANA zones and rejects junk', () => {
    expect(isValidTimeZone('America/Chicago')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });

  it('falls back to UTC for anything it cannot use', () => {
    expect(resolveTimeZone('Europe/Paris')).toBe('Europe/Paris');
    expect(resolveTimeZone('Mars/Olympus')).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone(null)).toBe(DEFAULT_TIME_ZONE);
  });

  it('lists zones with UTC always present', () => {
    const zones = listTimeZones();
    expect(zones).toContain('UTC');
    expect(zones).toContain('America/Chicago');
  });
});
