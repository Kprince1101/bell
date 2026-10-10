import {
  changedChoices,
  choicesFrom,
  hasBlankLabel,
} from '@/lib/calendars/choices';
import {
  describeHealth,
  healthDetails,
  isUnhealthy,
} from '@/lib/calendars/health';
import {
  buildCalendarsView,
  resolveCalendarMessages,
  unhealthyMessage,
} from '@/lib/calendars/view';
import { accountRow, calendarRow } from '@/test-utils/calendarFakes';

describe('describeHealth', () => {
  it('shows the last error of an unhealthy calendar', () => {
    expect(
      describeHealth(
        calendarRow({
          healthy: false,
          last_error: 'Google 500',
          fail_count: 3,
        }),
        'UTC',
      ),
    ).toEqual({ tone: 'unhealthy', text: 'Unhealthy: Google 500' });
  });

  it('shows the last sync in the user time zone', () => {
    expect(describeHealth(calendarRow(), 'America/Chicago')).toEqual({
      tone: 'healthy',
      text: 'Last synced Oct 10, 2026, 6:00 AM',
    });
    expect(
      describeHealth(calendarRow({ last_sync_at: null }), 'UTC').text,
    ).toBe('Waiting for first sync');
  });

  it('says when a calendar is not included', () => {
    expect(describeHealth(calendarRow({ active: false }), 'UTC')).toEqual({
      tone: 'off',
      text: 'Not included',
    });
  });

  it('lists last sync, channel expiry and last error for an included calendar', () => {
    expect(
      healthDetails(
        calendarRow({ last_error: 'Google 500', paused: true }),
        'America/Chicago',
      ),
    ).toEqual([
      'Last sync: Oct 10, 2026, 6:00 AM',
      'Push channel expires: Oct 15, 2026, 7:00 AM',
      'Last error: Google 500',
      'Paused: hidden from the agenda',
    ]);
    expect(
      healthDetails(
        calendarRow({ last_sync_at: null, channel_expires_at: null }),
        'UTC',
      ),
    ).toEqual(['Last sync: never', 'Push channel: none']);
    expect(healthDetails(calendarRow({ active: false }), 'UTC')).toEqual([]);
  });

  it('counts only active calendars as unhealthy', () => {
    expect(isUnhealthy({ active: true, healthy: false })).toBe(true);
    expect(isUnhealthy({ active: false, healthy: false })).toBe(false);
  });
});

describe('buildCalendarsView', () => {
  it('groups calendars under their account', () => {
    const other = accountRow({
      id: 'aaaaaaaa-0000-0000-0000-000000000002',
      email: 'me@client.com',
    });
    const view = buildCalendarsView(
      [accountRow(), other],
      [
        calendarRow(),
        calendarRow({ id: 'c2', account_id: other.id, label: 'Client' }),
      ],
      'UTC',
    );

    expect(
      view.map((account) => [
        account.email,
        account.calendars.map((c) => c.choice.label),
      ]),
    ).toEqual([
      ['me@gmail.com', ['Personal']],
      ['me@client.com', ['Client']],
    ]);
  });
});

describe('choices', () => {
  it('finds only the calendars the user changed', () => {
    const accounts = buildCalendarsView([accountRow()], [calendarRow()], 'UTC');
    const saved = choicesFrom(accounts);
    const id = calendarRow().id;

    expect(changedChoices(saved, saved)).toEqual([]);
    expect(
      changedChoices(
        { ...saved, [id]: { ...saved[id], color: '#000000' } },
        saved,
      ),
    ).toEqual([{ ...saved[id], color: '#000000' }]);
    expect(hasBlankLabel([{ ...saved[id], label: '  ' }])).toBe(true);
  });
});

describe('messages', () => {
  it('words the unhealthy banner', () => {
    expect(unhealthyMessage(0)).toBeNull();
    expect(unhealthyMessage(1)).toBe(
      '1 calendar is unhealthy and may be out of date.',
    );
    expect(unhealthyMessage(2)).toBe(
      '2 calendars are unhealthy and may be out of date.',
    );
  });

  it('turns known codes into copy and ignores unknown ones', () => {
    expect(resolveCalendarMessages({ notice: 'connected' }).notice).toMatch(
      /connected/,
    );
    expect(resolveCalendarMessages({ error: 'connect-failed' }).error).toMatch(
      /did not complete/,
    );
    expect(resolveCalendarMessages({ error: '<b>' })).toEqual({
      error: null,
      notice: null,
    });
  });
});
