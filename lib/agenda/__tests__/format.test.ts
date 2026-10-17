import {
  formatClock,
  formatCountdown,
  formatDayLabel,
  offsetMinutes,
  zoneLabel,
  zonesDiffer,
} from '@/lib/agenda/format';
import { addDaysToKey, agendaWindow, localDateKey } from '@/lib/agenda/window';

const OCT_8_NOON_CT = '2026-10-08T17:00:00.000Z';

describe('time zone helpers', () => {
  it('formats a clock time in a zone', () => {
    expect(formatClock(OCT_8_NOON_CT, 'America/Chicago')).toBe('12:00 PM');
    expect(formatClock(OCT_8_NOON_CT, 'America/New_York')).toBe('1:00 PM');
  });

  it('labels US zones generically and others by offset', () => {
    expect(zoneLabel(OCT_8_NOON_CT, 'America/Chicago')).toBe('CT');
    expect(zoneLabel(OCT_8_NOON_CT, 'America/New_York')).toBe('ET');
    expect(zoneLabel(OCT_8_NOON_CT, 'Europe/Paris')).toBe('GMT+2');
    expect(zoneLabel(OCT_8_NOON_CT, 'UTC')).toBe('UTC');
  });

  it('reads offsets including half hours and negatives', () => {
    expect(offsetMinutes(OCT_8_NOON_CT, 'America/Chicago')).toBe(-300);
    expect(offsetMinutes(OCT_8_NOON_CT, 'Asia/Kolkata')).toBe(330);
    expect(offsetMinutes(OCT_8_NOON_CT, 'UTC')).toBe(0);
  });

  it('flags a source zone only when its clock reads differently', () => {
    expect(
      zonesDiffer(OCT_8_NOON_CT, 'America/Chicago', 'America/New_York'),
    ).toBe(true);
    expect(
      zonesDiffer(OCT_8_NOON_CT, 'America/Chicago', 'America/Chicago'),
    ).toBe(false);
    expect(zonesDiffer(OCT_8_NOON_CT, 'America/Chicago', 'US/Central')).toBe(
      false,
    );
    expect(zonesDiffer(OCT_8_NOON_CT, 'America/Chicago', null)).toBe(false);
    expect(zonesDiffer(OCT_8_NOON_CT, 'America/Chicago', 'Mars/Base')).toBe(
      false,
    );
  });
});

describe('day helpers', () => {
  it('finds the local date of an instant', () => {
    expect(localDateKey('2026-10-11T03:00:00.000Z', 'America/Chicago')).toBe(
      '2026-10-10',
    );
    expect(localDateKey('2026-10-11T03:00:00.000Z', 'UTC')).toBe('2026-10-11');
    expect(addDaysToKey('2026-10-31', 1)).toBe('2026-11-01');
  });

  it('builds today plus seven days starting at local midnight', () => {
    const window = agendaWindow(
      new Date('2026-10-10T15:00:00.000Z'),
      'America/Chicago',
    );

    expect(window.todayKey).toBe('2026-10-10');
    expect(window.from).toBe('2026-10-10T05:00:00.000Z');
    expect(window.to).toBe('2026-10-18T05:00:00.000Z');
    expect(window.dayKeys).toHaveLength(8);
    expect(window.dayKeys.at(-1)).toBe('2026-10-17');
    expect(window.query).toEqual({
      from: '2026-10-09T05:00:00.000Z',
      to: '2026-10-19T05:00:00.000Z',
    });
  });

  it('names today and tomorrow, then dates', () => {
    expect(formatDayLabel('2026-10-10', '2026-10-10')).toBe('Today');
    expect(formatDayLabel('2026-10-11', '2026-10-10')).toBe('Tomorrow');
    expect(formatDayLabel('2026-10-12', '2026-10-10')).toBe('Mon, Oct 12');
  });
});

describe('formatCountdown', () => {
  it('counts down in seconds, minutes, hours and days', () => {
    expect(formatCountdown(9_200)).toBe('in 10s');
    expect(formatCountdown(5 * 60_000 + 9_000)).toBe('in 5m 09s');
    expect(formatCountdown(2 * 3_600_000 + 5 * 60_000 + 1_000)).toBe(
      'in 2h 05m 01s',
    );
    expect(formatCountdown(26 * 3_600_000)).toBe('in 1d 2h 00m');
    expect(formatCountdown(0)).toBe('Starting now');
  });
});
