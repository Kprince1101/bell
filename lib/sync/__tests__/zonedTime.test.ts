import { shiftDays, zonedMidnightToUtc } from '@/lib/sync/zonedTime';

describe('zonedMidnightToUtc', () => {
  it('converts a calendar date to that zone midnight in UTC', () => {
    expect(zonedMidnightToUtc('2026-10-20', 'America/Chicago')).toBe(
      '2026-10-20T05:00:00.000Z',
    );
    expect(zonedMidnightToUtc('2026-12-20', 'America/Chicago')).toBe(
      '2026-12-20T06:00:00.000Z',
    );
    expect(zonedMidnightToUtc('2026-10-20', 'Asia/Tokyo')).toBe(
      '2026-10-19T15:00:00.000Z',
    );
    expect(zonedMidnightToUtc('2026-10-20', 'UTC')).toBe(
      '2026-10-20T00:00:00.000Z',
    );
  });

  it('handles the day clocks change', () => {
    expect(zonedMidnightToUtc('2026-11-01', 'America/Chicago')).toBe(
      '2026-11-01T05:00:00.000Z',
    );
    expect(zonedMidnightToUtc('2026-03-29', 'Europe/London')).toBe(
      '2026-03-29T00:00:00.000Z',
    );
  });

  it('falls back to UTC for an unknown zone', () => {
    expect(zonedMidnightToUtc('2026-10-20', 'Mars/Olympus')).toBe(
      '2026-10-20T00:00:00.000Z',
    );
  });
});

describe('shiftDays', () => {
  it('moves by whole days', () => {
    expect(shiftDays(new Date('2026-10-10T00:00:00Z'), -7).toISOString()).toBe(
      '2026-10-03T00:00:00.000Z',
    );
  });
});
