import type { PGlite } from '@electric-sql/pglite';
import {
  connectSlack,
  savePhoneNumber,
  savePushoverKey,
  setCalendarQuiet,
  setChannelActive,
  testChannel,
} from '@/lib/notify/channels';
import { createNotifyRepo } from '@/lib/notify/repo';
import { createPgliteAdmin } from '@/supabase/testing/pgliteAdmin';
import {
  ME,
  NEIGHBOUR,
  PHONE,
  PUSHOVER_KEY,
  createNotifyDb,
} from '@/supabase/testing/notifySeed';
import { createFakeNotifyServices } from '@/test-utils/notifyFakes';

const setup = async () => {
  const { db, calendarId } = await createNotifyDb();
  const fakes = createFakeNotifyServices({
    repo: createNotifyRepo(createPgliteAdmin(db)),
  });
  return { db, calendarId, ...fakes };
};

const channels = async (db: PGlite) =>
  (
    await db.query<{ kind: string; active: boolean; hint: string }>(
      'select kind, active, hint from bell.channels where user_id = $1 order by kind',
      [ME],
    )
  ).rows;

describe('channel settings', () => {
  it('saves a Pushover key, switches it on and only shows its last four', async () => {
    const { db, services } = await setup();

    await savePushoverKey(services, ME, PUSHOVER_KEY);

    expect(await channels(db)).toEqual([
      { kind: 'pushover', active: true, hint: 'User key ending uuuu' },
    ]);
    await db.close();
  });

  it('one phone number serves both SMS and the call', async () => {
    const { db, services } = await setup();

    await savePhoneNumber(services, ME, PHONE);
    await setChannelActive(services, ME, 'voice', false);

    expect(await channels(db)).toEqual([
      { kind: 'sms', active: true, hint: 'Number ending 0100' },
      { kind: 'voice', active: false, hint: 'Number ending 0100' },
    ]);
    await db.close();
  });

  it('will not switch on a channel that has not been set up', async () => {
    const { db, services } = await setup();

    await expect(
      setChannelActive(services, ME, 'sms', true),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Set this channel up first.',
    });
    await db.close();
  });

  it('Test sends to the saved target, and a failure gives a plain message', async () => {
    const { db, services, twilio, log } = await setup();
    await savePhoneNumber(services, ME, PHONE);

    await testChannel(services, ME, 'voice');
    twilio.sendSms.mockRejectedValue(new Error('Twilio: 21211 invalid To'));

    expect(twilio.call).toHaveBeenCalledWith(
      PHONE,
      expect.stringContaining('Hello from Bell.'),
    );
    await expect(testChannel(services, ME, 'sms')).rejects.toMatchObject({
      status: 502,
      message: 'The test did not go through. Check the setting and try again.',
    });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('error=Twilio: 21211 invalid To'),
    );
    await db.close();
  });

  it('only quiets a calendar the user owns', async () => {
    const { db, calendarId, services } = await setup();

    await setCalendarQuiet(services, ME, calendarId, true);
    await expect(
      setCalendarQuiet(services, NEIGHBOUR, calendarId, false),
    ).rejects.toMatchObject({ status: 404 });

    const { rows } = await db.query<{ quiet: boolean }>(
      'select quiet from bell.calendars where id = $1',
      [calendarId],
    );
    expect(rows[0].quiet).toBe(true);
    await db.close();
  });
});

describe('connectSlack', () => {
  it('stores the workspace install encrypted, links the user and sends the first DM', async () => {
    const { db, services, slack } = await setup();

    await connectSlack(services, ME, 'code-1');

    const install = await db.query<{
      team_id: string;
      team_name: string;
      bot_token_encrypted: string;
      installed_by: string;
    }>('select * from bell.slack_installs');
    const secret = await db.query<{ value: string; slack_team_id: string }>(
      "select value, slack_team_id from bell.channel_secrets where kind = 'slack'",
    );
    expect(slack.exchangeCode).toHaveBeenCalledWith('code-1');
    expect(install.rows[0]).toMatchObject({
      team_id: 'T1',
      team_name: 'Toptal',
      bot_token_encrypted: 'sealed:xoxb-1',
      installed_by: ME,
    });
    expect(secret.rows).toEqual([{ value: 'U1', slack_team_id: 'T1' }]);
    expect(await channels(db)).toEqual([
      { kind: 'slack', active: true, hint: 'Toptal' },
    ]);
    expect(slack.postMessage).toHaveBeenCalledWith(
      'xoxb-1',
      'U1',
      expect.objectContaining({
        text: expect.stringContaining('test from Bell'),
      }),
    );
    await db.close();
  });
});
