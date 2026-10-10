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

  it('Slack carries Join and Acknowledge and says how far out', () => {
    const message = slackReminder({ ...reminder, step: '10m' });

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
      slackReminder({ ...reminder, join_url: null }).buttons.map((b) => b.text),
    ).toEqual(['Acknowledge']);
  });

  it('push priority climbs with the step', () => {
    expect(pushoverBody({ ...reminder, step: '30m' }).priority).toBe(0);
    expect(pushoverBody({ ...reminder, step: '10m' }).priority).toBe(1);
    expect(pushoverBody({ ...reminder, step: '2m' }).priority).toBe(2);
  });

  it('the SMS has title, time and join link', () => {
    expect(smsBody({ ...reminder, step: '2m' })).toBe(
      'Bell: Client sync starts in 2 minutes, at 2:00 PM CDT. Join: https://meet.google.com/abc-defg-hij Reply to acknowledge.',
    );
  });

  it('the call reads the title and time', () => {
    expect(voiceScript({ ...reminder, step: 'start', title: '  ' })).toBe(
      'Bell reminder. (no title) is starting now, at 2:00 PM CDT. Press any key to acknowledge.',
    );
  });

  it('a move names the new day and time', () => {
    expect(pushoverBody({ ...reminder, step: 'moved' }).message).toBe(
      'Client sync has moved to Sat, Oct 10, 2:00 PM CDT.',
    );
  });
});
