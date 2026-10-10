import {
  eventStatus,
  findJoinUrl,
  normalizeEvent,
  planDelta,
} from '@/lib/sync/normalize';
import {
  OFFSITE,
  STANDUP,
  STANDUP_DELETED,
  STANDUP_MOVED,
  TEAMS_CALL,
  WEEKLY_INSTANCE,
  ZOOM_CALL,
} from '@/test-utils/googleFixtures';

describe('normalizeEvent', () => {
  it('keeps the source zone and raw start beside normalized UTC times', () => {
    const event = normalizeEvent(STANDUP, 'UTC');

    expect(event).toMatchObject({
      event_id: 'standup',
      title: 'Standup',
      location: 'Room 4',
      starts_at: '2026-10-12T14:00:00.000Z',
      ends_at: '2026-10-12T14:15:00.000Z',
      source_tz: 'America/Chicago',
      raw_start: '2026-10-12T09:00:00-05:00',
      all_day: false,
      status: 'confirmed',
      organizer: 'boss@client.com',
      join_url: 'https://meet.google.com/abc-defg-hij',
      recurring_event_id: null,
      instance_at: null,
    });
    expect(event?.attendees).toEqual([
      {
        email: 'me@gmail.com',
        name: null,
        response: 'accepted',
        optional: false,
        organizer: false,
        self: true,
      },
      {
        email: 'boss@client.com',
        name: null,
        response: 'accepted',
        optional: false,
        organizer: true,
        self: false,
      },
    ]);
  });

  it('anchors all-day events to midnight in the calendar zone', () => {
    const event = normalizeEvent(OFFSITE, 'America/Chicago');

    expect(event).toMatchObject({
      starts_at: '2026-10-20T05:00:00.000Z',
      ends_at: '2026-10-21T05:00:00.000Z',
      raw_start: '2026-10-20',
      source_tz: 'America/Chicago',
      all_day: true,
      status: 'tentative',
      join_url: null,
    });
  });

  it('records the instance time of a recurring occurrence', () => {
    expect(normalizeEvent(WEEKLY_INSTANCE, 'UTC')).toMatchObject({
      recurring_event_id: 'weekly',
      instance_at: '2026-10-15T14:00:00.000Z',
    });
  });

  it('changes the fingerprint when an event moves and only then', () => {
    const original = normalizeEvent(STANDUP, 'UTC');
    const again = normalizeEvent({ ...STANDUP, description: 'notes' }, 'UTC');
    const moved = normalizeEvent(STANDUP_MOVED, 'UTC');

    expect(again?.fingerprint).toBe(original?.fingerprint);
    expect(moved?.fingerprint).not.toBe(original?.fingerprint);
    expect(original?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('skips events without usable times', () => {
    expect(normalizeEvent({ id: 'x' }, 'UTC')).toBeNull();
  });
});

describe('findJoinUrl', () => {
  it('prefers Meet, then a video entry point, then a link in the location', () => {
    expect(findJoinUrl(STANDUP)).toBe('https://meet.google.com/abc-defg-hij');
    expect(findJoinUrl(TEAMS_CALL)).toBe(
      'https://teams.microsoft.com/l/meetup/1',
    );
    expect(findJoinUrl(ZOOM_CALL)).toBe(
      'https://client.zoom.us/j/123456?pwd=abc',
    );
    expect(findJoinUrl(OFFSITE)).toBeNull();
  });
});

describe('eventStatus', () => {
  it('treats unknown statuses as confirmed', () => {
    expect(eventStatus(undefined)).toBe('confirmed');
    expect(eventStatus('weird')).toBe('confirmed');
    expect(eventStatus('cancelled')).toBe('cancelled');
  });
});

describe('planDelta', () => {
  it('splits upserts from cancellations and lets the last change win', () => {
    const delta = planDelta(
      [STANDUP, OFFSITE, STANDUP_DELETED, { id: 'broken' }],
      'UTC',
    );

    expect(delta.cancelled).toEqual(['standup']);
    expect(delta.upserts.map((event) => event.event_id)).toEqual(['offsite']);
  });
});
