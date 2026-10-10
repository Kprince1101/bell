import { createHmac } from 'node:crypto';
import { twilioSignature } from '@/lib/notify/twilio';
import {
  handlePushoverCallback,
  handleSlackInteraction,
  handleTwilioSms,
  handleTwilioVoice,
} from '@/lib/notify/webhooks';
import {
  EVENT_ID,
  NOTIFICATION_ID,
  createFakeNotifyServices,
  delivery,
} from '@/test-utils/notifyFakes';
import { USER_ID } from '@/test-utils/supabaseFake';

const NOW_SECONDS = Date.parse('2026-10-10T13:30:00.000Z') / 1000;

const slackRequest = (payload: unknown, secret = 'signing') => {
  const body = `payload=${encodeURIComponent(JSON.stringify(payload))}`;
  const timestamp = String(NOW_SECONDS);
  const signature = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')}`;
  return { body, timestamp, signature };
};

const ackPayload = (value = EVENT_ID) => ({
  type: 'block_actions',
  user: { id: 'U1', name: 'kris' },
  team: { id: 'T1' },
  actions: [{ action_id: 'bell_ack', value }],
});

describe('handleSlackInteraction', () => {
  it('acknowledges when the person who pressed it owns the event', async () => {
    const { services, repo, slack } = createFakeNotifyServices();
    repo.slackEventOwner.mockResolvedValue(USER_ID);
    repo.acknowledge.mockResolvedValue([
      delivery({
        channel: 'slack',
        provider_ref: 'D1|1.2',
        slack_bot_token: 'sealed:xoxb-1',
      }),
    ]);

    const outcome = await handleSlackInteraction(
      services,
      'signing',
      slackRequest(ackPayload()),
    );

    expect(outcome).toBe('acknowledged');
    expect(repo.slackEventOwner).toHaveBeenCalledWith(EVENT_ID, 'T1', 'U1');
    expect(repo.acknowledge).toHaveBeenCalledWith(
      { eventId: EVENT_ID, userId: USER_ID },
      'slack:U1',
      '2026-10-10T13:30:00.000Z',
    );
    expect(slack.updateMessage).toHaveBeenCalledWith(
      'xoxb-1',
      { channel: 'D1', ts: '1.2' },
      expect.objectContaining({
        buttons: [expect.objectContaining({ text: 'Join' })],
      }),
    );
  });

  it('ignores a press by someone else and the Join button', async () => {
    const { services, repo } = createFakeNotifyServices();

    expect(
      await handleSlackInteraction(
        services,
        'signing',
        slackRequest(ackPayload()),
      ),
    ).toBe('ignored');
    expect(
      await handleSlackInteraction(
        services,
        'signing',
        slackRequest({
          ...ackPayload(),
          actions: [{ action_id: 'bell_join' }],
        }),
      ),
    ).toBe('ignored');
    expect(repo.acknowledge).not.toHaveBeenCalled();
  });

  it('rejects a request not signed by Slack', async () => {
    const { services, repo } = createFakeNotifyServices();

    expect(
      await handleSlackInteraction(
        services,
        'signing',
        slackRequest(ackPayload(), 'forged'),
      ),
    ).toBe('rejected');
    expect(repo.slackEventOwner).not.toHaveBeenCalled();
  });
});

describe('handleTwilioSms', () => {
  const url = 'https://bell.test/api/webhooks/twilio/sms';

  it('refuses a forged text', async () => {
    const { services, repo } = createFakeNotifyServices();

    const reply = await handleTwilioSms(services, 'token', {
      url,
      params: { From: '+15125550100', Body: 'ok' },
      signature: 'forged',
    });

    expect(reply.outcome).toBe('rejected');
    expect(repo.ackTargetsForPhone).not.toHaveBeenCalled();
  });

  it('says so when there is nothing to acknowledge', async () => {
    const { services } = createFakeNotifyServices();
    const params = { From: '+15125550100', Body: 'ok' };

    const reply = await handleTwilioSms(services, 'token', {
      url,
      params,
      signature: twilioSignature('token', url, params),
    });

    expect(reply.outcome).toBe('ignored');
    expect(reply.twiml).toContain('nothing to acknowledge');
  });
});

describe('handleTwilioVoice', () => {
  const url = `https://bell.test/api/webhooks/twilio/voice?n=${NOTIFICATION_ID}`;
  const owner = {
    eventId: EVENT_ID,
    userId: USER_ID,
    providerRef: 'CA1',
    target: '+15125550100',
  };

  it('a keypress acknowledges the event the call was for', async () => {
    const { services, repo } = createFakeNotifyServices();
    repo.notificationOwner.mockResolvedValue(owner);
    const params = { Digits: '5', CallSid: 'CA1' };

    const reply = await handleTwilioVoice(
      services,
      'token',
      { url, params, signature: twilioSignature('token', url, params) },
      NOTIFICATION_ID,
    );

    expect(reply.outcome).toBe('acknowledged');
    expect(reply.twiml).toContain('<Say>Acknowledged. Goodbye.</Say>');
    expect(repo.acknowledge).toHaveBeenCalledWith(
      {
        eventId: EVENT_ID,
        userId: USER_ID,
        providerRef: 'CA1',
        target: '+15125550100',
      },
      'voice:+15125550100',
      expect.any(String),
    );
  });

  it('no keypress acknowledges nothing', async () => {
    const { services, repo } = createFakeNotifyServices();
    repo.notificationOwner.mockResolvedValue(owner);
    const params = { CallSid: 'CA1' };

    const reply = await handleTwilioVoice(
      services,
      'token',
      { url, params, signature: twilioSignature('token', url, params) },
      NOTIFICATION_ID,
    );

    expect(reply.outcome).toBe('ignored');
    expect(repo.acknowledge).not.toHaveBeenCalled();
  });
});

describe('handlePushoverCallback', () => {
  const signedLink = (
    services: ReturnType<typeof createFakeNotifyServices>['services'],
  ) => new URL(services.links.pushoverCallback(NOTIFICATION_ID));

  it('rejects a callback without Bell’s signature', async () => {
    const { services, repo } = createFakeNotifyServices();

    expect(
      await handlePushoverCallback(services, {
        notificationId: NOTIFICATION_ID,
        signature: 'forged',
        form: { receipt: 'receipt-1', acknowledged: '1' },
      }),
    ).toBe('rejected');
    expect(repo.notificationOwner).not.toHaveBeenCalled();
  });

  it('ignores a receipt that does not match the push it was for', async () => {
    const { services, repo } = createFakeNotifyServices();
    repo.notificationOwner.mockResolvedValue({
      eventId: EVENT_ID,
      userId: USER_ID,
      providerRef: 'receipt-1',
      target: 'key',
    });
    const link = signedLink(services);

    expect(
      await handlePushoverCallback(services, {
        notificationId: link.searchParams.get('n'),
        signature: link.searchParams.get('sig'),
        form: { receipt: 'receipt-other', acknowledged: '1' },
      }),
    ).toBe('ignored');
    expect(repo.acknowledge).not.toHaveBeenCalled();
  });
});
