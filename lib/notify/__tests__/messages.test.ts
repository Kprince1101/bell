import {
  formatEventTime,
  pushoverBody,
  slackReminder,
  smsBody,
  voiceScript,
} from '@/lib/notify/messages';
import { delivery } from '@/test-utils/notifyFakes';

describe('formatEventTime', () => {
  it("shows the user's zone and adds the invite's zone when it differs", () => {
    expect(
      formatEventTime(
        '2026-10-10T19:00:00Z',
        'America/Chicago',
        'America/Los_Angeles',
      ),
    ).toBe('2:00 PM CDT (12:00 PM PDT in the invite)');
  });

  it('shows one time when the zones match or the invite has none', () => {
    expect(
      formatEventTime(
        '2026-10-10T19:00:00Z',
        'America/Chicago',
        'America/Chicago',
      ),
    ).toBe('2:00 PM CDT');
    expect(
      formatEventTime('2026-10-10T19:00:00Z', 'America/Chicago', null),
    ).toBe('2:00 PM CDT');
  });
});

describe('reminder messages', () => {
  const reminder = delivery({
    starts_at: '2026-10-10T19:00:00+00:00',
    source_tz: 'America/Chicago',
  });
  const minutesBefore = (minutes: number) =>
    new Date(Date.parse(reminder.starts_at) - minutes * 60_000);

  it('Slack carries Join and Acknowledge and says how far out', () => {
    const message = slackReminder(
      { ...reminder, step: '10m' },
      minutesBefore(10),
    );

    expect(message.text).toBe(
      ':bell: *Client sync* starts in 10 minutes, at 2:00 PM CDT.',
    );
    expect(
      message.buttons.map((button) => [button.text, button.value]),
    ).toEqual([
      ['Join', undefined],
      ['Acknowledge', reminder.event_id],
    ]);
  });

  it('Slack drops Join when there is no link', () => {
    expect(
      slackReminder(
        { ...reminder, join_url: null },
        minutesBefore(30),
      ).buttons.map((b) => b.text),
    ).toEqual(['Acknowledge']);
  });

  it('push priority climbs with the step', () => {
    const now = minutesBefore(30);
    expect(pushoverBody({ ...reminder, step: '30m' }, now).priority).toBe(0);
    expect(pushoverBody({ ...reminder, step: '10m' }, now).priority).toBe(1);
    expect(pushoverBody({ ...reminder, step: '2m' }, now).priority).toBe(2);
  });

  it('the SMS has title, time and join link', () => {
    expect(smsBody({ ...reminder, step: '2m' }, minutesBefore(2))).toBe(
      'Bell: Client sync starts in 2 minutes, at 2:00 PM CDT. Join: https://meet.google.com/abc-defg-hij Reply to acknowledge.',
    );
  });

  it('the call reads the title and time', () => {
    expect(
      voiceScript(
        { ...reminder, step: 'start', title: '  ' },
        minutesBefore(0),
      ),
    ).toBe(
      'Bell reminder. (no title) is starting now, at 2:00 PM CDT. Press any key to acknowledge.',
    );
  });

  it('a move names the new day and time', () => {
    expect(
      pushoverBody({ ...reminder, step: 'moved' }, minutesBefore(60)).message,
    ).toBe('Client sync has moved to Sat, Oct 10, 2:00 PM CDT.');
  });

  it('says the real time left when a step goes out late', () => {
    const tenMinuteStep = { ...reminder, step: '10m' as const };

    expect(slackReminder(tenMinuteStep, minutesBefore(2.5)).text).toBe(
      ':bell: *Client sync* starts in 3 minutes, at 2:00 PM CDT.',
    );
    expect(pushoverBody(tenMinuteStep, minutesBefore(1)).message).toBe(
      'Client sync starts in 1 minute, at 2:00 PM CDT.',
    );
    expect(
      voiceScript({ ...reminder, step: 'start' }, minutesBefore(-2)),
    ).toContain('Client sync started 2 minutes ago, at 2:00 PM CDT.');
  });
});
