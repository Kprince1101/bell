import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { PUT as quiet } from '@/app/api/calendars/quiet/route';
import { PATCH as toggle } from '@/app/api/channels/route';
import { PUT as phone } from '@/app/api/channels/phone/route';
import { PUT as pushoverKey } from '@/app/api/channels/pushover/route';
import { POST as test } from '@/app/api/channels/test/route';
import { POST as ack } from '@/app/api/notifications/ack/route';
import { GET as slackCallback } from '@/app/api/slack/callback/route';
import { GET as slackConnect } from '@/app/api/slack/connect/route';
import { POST as pushoverHook } from '@/app/api/webhooks/pushover/route';
import { POST as slackHook } from '@/app/api/webhooks/slack/route';
import { POST as smsHook } from '@/app/api/webhooks/twilio/sms/route';
import { POST as voiceHook } from '@/app/api/webhooks/twilio/voice/route';
import { notifyServices } from '@/lib/notify/notifyServices';
import { twilioSignature } from '@/lib/notify/twilio';
import { createClient } from '@/lib/supabase/server';
import {
  EVENT_ID,
  NOTIFICATION_ID,
  createFakeNotifyServices,
} from '@/test-utils/notifyFakes';
import { USER_ID, createSupabaseFake } from '@/test-utils/supabaseFake';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/notify/notifyServices', () => ({ notifyServices: vi.fn() }));

const setup = (
  user: { id: string; email?: string } | null = {
    id: USER_ID,
    email: 'me@example.com',
  },
) => {
  const fakes = createFakeNotifyServices();
  vi.mocked(notifyServices).mockReturnValue(fakes.services);
  vi.mocked(createClient).mockResolvedValue(
    createSupabaseFake({ user }).client,
  );
  return fakes;
};

const json = (url: string, method: string, body: unknown) =>
  new Request(`https://bell.test${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const form = (
  url: string,
  params: Record<string, string>,
  headers: Record<string, string> = {},
) =>
  new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body: new URLSearchParams(params).toString(),
  });

beforeEach(() => {
  vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC1');
  vi.stubEnv('TWILIO_AUTH_TOKEN', 'twilio-token');
  vi.stubEnv('TWILIO_FROM_NUMBER', '+15125550000');
  vi.stubEnv('SLACK_CLIENT_ID', 'client');
  vi.stubEnv('SLACK_CLIENT_SECRET', 'secret');
  vi.stubEnv('SLACK_SIGNING_SECRET', 'signing');
  vi.stubEnv('BELL_APP_URL', 'https://bell.test');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('channel settings routes', () => {
  it('refuse a signed-out visitor', async () => {
    const { repo } = setup(null);

    const response = await pushoverKey(
      json('/api/channels/pushover', 'PUT', { key: 'u'.repeat(30) }),
    );

    expect(response.status).toBe(401);
    expect(repo.saveChannelSecret).not.toHaveBeenCalled();
  });

  it('save a Pushover key and explain a bad one', async () => {
    const { repo } = setup();

    const good = await pushoverKey(
      json('/api/channels/pushover', 'PUT', { key: ` ${'a'.repeat(30)} ` }),
    );
    const bad = await pushoverKey(
      json('/api/channels/pushover', 'PUT', { key: 'short' }),
    );

    expect(good.status).toBe(200);
    expect(repo.saveChannelSecret).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, value: 'a'.repeat(30) }),
    );
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({
      error: 'A Pushover user key is 30 letters and digits',
    });
  });

  it('normalize a phone number before saving it', async () => {
    const { repo } = setup();

    const response = await phone(
      json('/api/channels/phone', 'PUT', { number: '+1 (512) 555-0100' }),
    );

    expect(response.status).toBe(200);
    expect(repo.saveChannelSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        kinds: ['sms', 'voice'],
        value: '+15125550100',
      }),
    );
  });

  it('switch a channel off and send a test', async () => {
    const { repo, pushover } = setup();
    repo.channelTarget.mockResolvedValue({
      target: 'u'.repeat(30),
      slack_team_id: null,
      slack_bot_token: null,
    });

    const off = await toggle(
      json('/api/channels', 'PATCH', { kind: 'pushover', active: false }),
    );
    const sent = await test(
      json('/api/channels/test', 'POST', { kind: 'pushover' }),
    );

    expect(off.status).toBe(200);
    expect(repo.setChannelActive).toHaveBeenCalledWith(
      USER_ID,
      'pushover',
      false,
    );
    expect(sent.status).toBe(200);
    expect(pushover.send).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Bell test', priority: 0 }),
    );
  });

  it('quiet a calendar and acknowledge from the app', async () => {
    const { repo } = setup();
    const calendarId = 'cccccccc-0000-4000-8000-000000000001';

    await quiet(
      json('/api/calendars/quiet', 'PUT', { calendarId, quiet: true }),
    );
    const response = await ack(
      json('/api/notifications/ack', 'POST', { eventId: EVENT_ID }),
    );

    expect(repo.setCalendarQuiet).toHaveBeenCalledWith(
      USER_ID,
      calendarId,
      true,
    );
    expect(response.status).toBe(200);
    expect(repo.acknowledge).toHaveBeenCalledWith(
      { eventId: EVENT_ID, userId: USER_ID },
      'app:me@example.com',
      expect.any(String),
    );
  });
});

describe('Slack connect', () => {
  it('sends the user to Add to Slack with a state cookie', async () => {
    const { slack } = setup();

    const response = await slackConnect();

    const location = new URL(response.headers.get('location') ?? '');
    const state = location.searchParams.get('state') ?? '';
    expect(slack.authorizeUrl).toHaveBeenCalledWith(state);
    expect(response.headers.get('set-cookie')).toContain(
      `bell_slack_state=${state}`,
    );
  });

  it('refuses a callback whose state does not match', async () => {
    const { slack } = setup();

    const response = await slackCallback(
      new NextRequest(
        'https://bell.test/api/slack/callback?code=c&state=forged',
        {
          headers: { cookie: 'bell_slack_state=real' },
        },
      ),
    );

    expect(response.headers.get('location')).toBe(
      'https://bell.test/notifications?error=slack-failed',
    );
    expect(slack.exchangeCode).not.toHaveBeenCalled();
  });

  it('connects and lands back on Notifications', async () => {
    const { repo } = setup();
    repo.channelTarget.mockResolvedValue({
      target: 'U1',
      slack_team_id: 'T1',
      slack_bot_token: 'sealed:xoxb-1',
    });

    const response = await slackCallback(
      new NextRequest('https://bell.test/api/slack/callback?code=c&state=s', {
        headers: { cookie: 'bell_slack_state=s' },
      }),
    );

    expect(response.headers.get('location')).toBe(
      'https://bell.test/notifications?notice=slack-connected',
    );
  });
});

describe('acknowledgement webhooks', () => {
  it('Twilio SMS: verifies the signature against the public URL', async () => {
    const { repo } = setup(null);
    repo.ackTargetsForPhone.mockResolvedValue([
      { eventId: EVENT_ID, userId: USER_ID },
    ]);
    const url = 'https://bell.test/api/webhooks/twilio/sms';
    const params = { From: '+15125550100', Body: 'k' };

    const response = await smsHook(
      form(url, params, {
        'X-Twilio-Signature': twilioSignature('twilio-token', url, params),
      }),
    );
    const forged = await smsHook(
      form(url, params, { 'X-Twilio-Signature': 'nope' }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/xml');
    expect(await response.text()).toContain('acknowledged');
    expect(repo.acknowledge).toHaveBeenCalledTimes(1);
    expect(forged.status).toBe(401);
  });

  it('Twilio voice: a keypress acknowledges', async () => {
    const { repo } = setup(null);
    repo.notificationOwner.mockResolvedValue({
      eventId: EVENT_ID,
      userId: USER_ID,
      providerRef: 'CA1',
      target: '+15125550100',
    });
    const url = `https://bell.test/api/webhooks/twilio/voice?n=${NOTIFICATION_ID}`;
    const params = { Digits: '1' };

    const response = await voiceHook(
      form(url, params, {
        'X-Twilio-Signature': twilioSignature('twilio-token', url, params),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Acknowledged. Goodbye.');
  });

  it('Slack: a signed Acknowledge press is accepted, an unsigned one is not', async () => {
    const { repo } = setup(null);
    repo.slackEventOwner.mockResolvedValue(USER_ID);
    const body = `payload=${encodeURIComponent(
      JSON.stringify({
        type: 'block_actions',
        user: { id: 'U1' },
        team: { id: 'T1' },
        actions: [{ action_id: 'bell_ack', value: EVENT_ID }],
      }),
    )}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = `v0=${createHmac('sha256', 'signing').update(`v0:${timestamp}:${body}`).digest('hex')}`;
    const request = (sig: string) =>
      new Request('https://bell.test/api/webhooks/slack', {
        method: 'POST',
        headers: {
          'X-Slack-Request-Timestamp': timestamp,
          'X-Slack-Signature': sig,
        },
        body,
      });
    const fakes = createFakeNotifyServices({ now: () => new Date() });
    fakes.repo.slackEventOwner.mockResolvedValue(USER_ID);
    vi.mocked(notifyServices).mockReturnValue(fakes.services);

    expect((await slackHook(request(signature))).status).toBe(200);
    expect((await slackHook(request('v0=bad'))).status).toBe(401);
    expect(fakes.repo.acknowledge).toHaveBeenCalledTimes(1);
    expect(repo.acknowledge).not.toHaveBeenCalled();
  });

  it('Pushover: refuses an unsigned callback', async () => {
    const { repo } = setup(null);

    const response = await pushoverHook(
      form(
        `https://bell.test/api/webhooks/pushover?n=${NOTIFICATION_ID}&sig=x`,
        {
          receipt: 'r',
          acknowledged: '1',
        },
      ),
    );

    expect(response.status).toBe(401);
    expect(repo.acknowledge).not.toHaveBeenCalled();
  });
});
