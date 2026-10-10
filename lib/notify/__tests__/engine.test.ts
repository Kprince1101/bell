import { runNotify } from '@/lib/notify/engine';
import { createNotifyRepo } from '@/lib/notify/repo';
import { handlePushoverCallback, handleTwilioSms } from '@/lib/notify/webhooks';
import { twilioSignature } from '@/lib/notify/twilio';
import { createPgliteAdmin } from '@/supabase/testing/pgliteAdmin';
import {
  ME,
  PHONE,
  PUSHOVER_KEY,
  addEvent,
  connectEveryChannel,
  createNotifyDb,
  notificationsFor,
  plusMinutes,
  stepsOf,
  thisMinute,
} from '@/supabase/testing/notifySeed';
import { createFakeNotifyServices } from '@/test-utils/notifyFakes';

const setup = async () => {
  const { db, calendarId } = await createNotifyDb();
  await connectEveryChannel(db, ME);
  const base = thisMinute();
  let clock = base;
  const fakes = createFakeNotifyServices({
    repo: createNotifyRepo(createPgliteAdmin(db)),
    now: () => clock,
  });
  const tickAt = async (minutes: number) => {
    clock = plusMinutes(base, minutes);
    return runNotify(fakes.services);
  };
  const eventId = await addEvent(db, calendarId, {
    startsAt: plusMinutes(base, 30),
    title: 'Client sync',
  });
  return { db, base, eventId, tickAt, ...fakes };
};

describe('runNotify escalation', () => {
  it('walks Slack and push, then emergency push and SMS, then the call, each exactly once', async () => {
    const { db, eventId, tickAt, slack, pushover, twilio } = await setup();

    await tickAt(0);
    await tickAt(0);
    expect(slack.postMessage).toHaveBeenCalledTimes(1);
    expect(slack.postMessage.mock.calls[0][0]).toBe('xoxb-1');
    expect(slack.postMessage.mock.calls[0][1]).toBe('U1');
    expect(
      slack.postMessage.mock.calls[0][2].buttons.map((b) => b.text),
    ).toEqual(['Join', 'Acknowledge']);
    expect(pushover.send).toHaveBeenCalledTimes(1);
    expect(pushover.send.mock.calls[0][0]).toMatchObject({
      user: PUSHOVER_KEY,
      priority: 0,
    });

    await tickAt(20);
    await tickAt(20);
    expect(slack.updateMessage).toHaveBeenCalledTimes(1);
    expect(slack.updateMessage.mock.calls[0][1]).toEqual({
      channel: 'D1',
      ts: '1700000000.000100',
    });
    expect(slack.updateMessage.mock.calls[0][2].text).toContain(
      'starts in 10 minutes',
    );
    expect(pushover.send).toHaveBeenCalledTimes(2);
    expect(pushover.send.mock.calls[1][0].priority).toBe(1);

    await tickAt(28);
    await tickAt(28);
    expect(pushover.send).toHaveBeenCalledTimes(3);
    expect(pushover.send.mock.calls[2][0]).toMatchObject({ priority: 2 });
    expect(pushover.send.mock.calls[2][0].callback).toContain(
      'https://bell.test/api/webhooks/pushover?n=',
    );
    expect(twilio.sendSms).toHaveBeenCalledTimes(1);
    expect(twilio.sendSms.mock.calls[0][0]).toBe(PHONE);
    expect(twilio.sendSms.mock.calls[0][1]).toContain('Client sync');
    expect(twilio.sendSms.mock.calls[0][1]).toContain(
      'https://meet.google.com/abc-defg-hij',
    );

    await tickAt(30);
    await tickAt(30);
    expect(twilio.call).toHaveBeenCalledTimes(1);
    expect(twilio.call.mock.calls[0][1]).toContain(
      'Client sync is starting now',
    );
    expect(twilio.call.mock.calls[0][1]).toContain('<Gather');

    const rows = await notificationsFor(db, eventId);
    expect(stepsOf(rows)).toEqual([
      '30m:slack:sent',
      '30m:pushover:sent',
      '10m:slack:sent',
      '10m:pushover:sent',
      '2m:pushover:sent',
      '2m:sms:sent',
      'start:voice:sent',
    ]);
    expect(rows.map((row) => row.provider_ref)).toEqual([
      'D1|1700000000.000100',
      null,
      'D1|1700000000.000100',
      null,
      'receipt-1',
      'SM1',
      'CA1',
    ]);
    await db.close();
  });

  it('acknowledging the emergency push stops everything before the call', async () => {
    const { db, eventId, tickAt, services, pushover, twilio, slack } =
      await setup();
    await tickAt(0);
    await tickAt(20);
    await tickAt(28);
    const emergency = pushover.send.mock.calls.find(
      ([message]) => message.priority === 2,
    );
    const callback = new URL(emergency?.[0].callback ?? '');

    const outcome = await handlePushoverCallback(services, {
      notificationId: callback.searchParams.get('n'),
      signature: callback.searchParams.get('sig'),
      form: {
        receipt: 'receipt-1',
        acknowledged: '1',
        acknowledged_by: PUSHOVER_KEY,
      },
    });
    await tickAt(30);

    expect(outcome).toBe('acknowledged');
    expect(pushover.cancelReceipt).toHaveBeenCalledWith('receipt-1');
    expect(twilio.call).not.toHaveBeenCalled();
    expect(slack.updateMessage).toHaveBeenCalledTimes(2);
    expect(slack.updateMessage).toHaveBeenLastCalledWith(
      'xoxb-1',
      { channel: 'D1', ts: '1700000000.000100' },
      expect.objectContaining({
        text: expect.stringContaining('Acknowledged'),
      }),
    );
    const rows = await notificationsFor(db, eventId);
    expect(stepsOf(rows).slice(-1)).toEqual(['start:voice:skipped']);
    expect(
      rows.every((row) => row.acknowledged_by === `pushover:${PUSHOVER_KEY}`),
    ).toBe(true);
    await db.close();
  });

  it('any SMS reply acknowledges the meeting the text was about', async () => {
    const { db, eventId, tickAt, services, twilio } = await setup();
    await tickAt(28);
    const url = 'https://bell.test/api/webhooks/twilio/sms';
    const params = { From: PHONE, Body: 'ok' };

    const reply = await handleTwilioSms(services, 'twilio-token', {
      url,
      params,
      signature: twilioSignature('twilio-token', url, params),
    });
    await tickAt(30);

    expect(reply.outcome).toBe('acknowledged');
    expect(reply.twiml).toContain('acknowledged');
    expect(twilio.call).not.toHaveBeenCalled();
    expect((await notificationsFor(db, eventId))[0].acknowledged_by).toBe(
      `sms:${PHONE}`,
    );
    await db.close();
  });

  it('falls through to the next channel when a send fails and records why', async () => {
    const { db, eventId, tickAt, pushover, twilio } = await setup();
    pushover.send.mockRejectedValue(new Error('Pushover: user key is invalid'));

    const report = await tickAt(0);

    expect(report).toMatchObject({ due: 2, sent: 2, failed: 1, fallbacks: 1 });
    expect(twilio.sendSms).toHaveBeenCalledWith(
      PHONE,
      expect.stringContaining('starts in 30 minutes'),
    );
    const rows = (await notificationsFor(db, eventId)).filter(
      (row) => row.step === '30m',
    );
    expect(
      rows.map((row) => [row.channel, row.result, row.error, row.fallback_for]),
    ).toEqual([
      ['slack', 'sent', null, null],
      ['pushover', 'failed', 'Pushover: user key is invalid', null],
      ['sms', 'sent', null, 'pushover'],
    ]);
    await db.close();
  });

  it('a moved meeting inside two hours gets one push and new step times', async () => {
    const { db, base, eventId, tickAt, pushover } = await setup();
    await tickAt(0);
    pushover.send.mockClear();

    await db.query('update bell.events set starts_at = $2 where id = $1', [
      eventId,
      plusMinutes(base, 45).toISOString(),
    ]);
    await tickAt(2);
    await tickAt(2);

    expect(pushover.send).toHaveBeenCalledTimes(1);
    expect(pushover.send.mock.calls[0][0].message).toContain('has moved to');
    await tickAt(15);
    expect(pushover.send).toHaveBeenCalledTimes(2);
    expect(pushover.send.mock.calls[1][0].message).toContain(
      'starts in 30 minutes',
    );
    await db.close();
  });

  it('a cancelled meeting stops ringing', async () => {
    const { db, eventId, tickAt, pushover, twilio } = await setup();
    await tickAt(0);

    await db.query(
      "update bell.events set status = 'cancelled' where id = $1",
      [eventId],
    );
    await tickAt(20);
    await tickAt(28);
    await tickAt(30);

    expect(pushover.send).toHaveBeenCalledTimes(1);
    expect(twilio.sendSms).not.toHaveBeenCalled();
    expect(twilio.call).not.toHaveBeenCalled();
    await db.close();
  });
});
