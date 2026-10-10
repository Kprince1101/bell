import {
  buildChannelViews,
  buildRingingViews,
  resolveNotifyMessages,
} from '@/lib/notify/view';

describe('buildChannelViews', () => {
  it('lists every channel kind, set up or not', () => {
    expect(
      buildChannelViews([
        { kind: 'pushover', active: false, hint: 'User key ending abcd' },
      ]),
    ).toEqual([
      { kind: 'slack', configured: false, active: false, hint: null },
      {
        kind: 'pushover',
        configured: true,
        active: false,
        hint: 'User key ending abcd',
      },
      { kind: 'sms', configured: false, active: false, hint: null },
      { kind: 'voice', configured: false, active: false, hint: null },
    ]);
  });
});

describe('buildRingingViews', () => {
  it('orders unacknowledged meetings by start and marks the ones already ringing', () => {
    const event = (id: string, starts_at: string, status = 'confirmed') => ({
      id,
      title: `Meeting ${id}`,
      starts_at,
      join_url: null,
      source_tz: 'America/Chicago',
      status,
    });

    const views = buildRingingViews(
      [
        { event_id: 'b', sent_at: '2026-10-10T18:30:00Z' },
        { event_id: 'a', sent_at: null },
      ],
      [
        event('a', '2026-10-10T19:30:00Z'),
        event('b', '2026-10-10T19:00:00Z'),
        event('c', '2026-10-10T19:00:00Z', 'cancelled'),
      ],
      'America/Chicago',
    );

    expect(views.map((view) => [view.eventId, view.when, view.status])).toEqual(
      [
        ['b', '2:00 PM CDT', 'Ringing'],
        ['a', '2:30 PM CDT', 'Coming up'],
      ],
    );
  });
});

describe('resolveNotifyMessages', () => {
  it('maps known codes to copy and drops unknown ones', () => {
    expect(
      resolveNotifyMessages({ notice: 'slack-connected', error: 'nope' }),
    ).toEqual({
      notice: 'Slack connected. Bell just sent you a test DM.',
      error: null,
    });
  });
});
