import {
  STALE_AFTER_MS,
  formatAge,
  isPast,
  isStale,
} from '@/lib/health/staleness';

const NOW = new Date('2026-10-10T18:00:00.000Z');

const ago = (ms: number): string => new Date(NOW.getTime() - ms).toISOString();

describe('isStale', () => {
  it('uses five minutes as the limit', () => {
    expect(STALE_AFTER_MS).toBe(300_000);
  });

  it('is fresh up to and including exactly five minutes', () => {
    expect(isStale(ago(0), NOW)).toBe(false);
    expect(isStale(ago(299_999), NOW)).toBe(false);
    expect(isStale(ago(300_000), NOW)).toBe(false);
  });

  it('is stale one millisecond past five minutes', () => {
    expect(isStale(ago(300_001), NOW)).toBe(true);
    expect(isStale(ago(86_400_000), NOW)).toBe(true);
  });

  it('treats never as stale', () => {
    expect(isStale(null, NOW)).toBe(true);
  });

  it('treats a time in the future as fresh', () => {
    expect(isStale(ago(-60_000), NOW)).toBe(false);
  });

  it('accepts a different limit', () => {
    expect(isStale(ago(90_000), NOW, 60_000)).toBe(true);
  });

  it('reads Postgres-style offsets', () => {
    expect(isStale('2026-10-10T17:56:00+00:00', NOW)).toBe(false);
    expect(isStale('2026-10-10T12:54:00-05:00', NOW)).toBe(true);
  });
});

describe('isPast', () => {
  it('is true for missing or elapsed times and false for future ones', () => {
    expect(isPast(null, NOW)).toBe(true);
    expect(isPast(ago(0), NOW)).toBe(true);
    expect(isPast(ago(-1), NOW)).toBe(false);
  });
});

describe('formatAge', () => {
  it('reads as seconds, minutes, hours, then days', () => {
    expect(formatAge(ago(12_000), NOW)).toBe('12s ago');
    expect(formatAge(ago(5 * 60_000), NOW)).toBe('5 min ago');
    expect(formatAge(ago(3 * 3_600_000), NOW)).toBe('3 h ago');
    expect(formatAge(ago(3 * 86_400_000), NOW)).toBe('3 days ago');
  });

  it('never shows a negative age', () => {
    expect(formatAge(ago(-30_000), NOW)).toBe('0s ago');
  });
});
