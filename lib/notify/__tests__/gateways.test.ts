import { createHmac } from 'node:crypto';
import { createPushoverGateway, pushoverForm } from '@/lib/notify/pushover';
import {
  createSlackGateway,
  decodeSlackRef,
  verifySlackSignature,
} from '@/lib/notify/slack';
import {
  createTwilioGateway,
  reminderCallTwiml,
  twilioSignature,
  verifyTwilioSignature,
} from '@/lib/notify/twilio';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const fetchReturning = (...responses: Response[]) => {
  const fetchImpl = vi.fn<typeof fetch>();
  responses.forEach((response) => fetchImpl.mockResolvedValueOnce(response));
  return fetchImpl;
};

const formOf = (init: RequestInit | undefined) =>
  Object.fromEntries(new URLSearchParams(String(init?.body)));

const SLACK_CONFIG = {
  clientId: 'client',
  clientSecret: 'secret',
  signingSecret: 'signing',
  redirectUri: 'https://bell.test/api/slack/callback',
};

describe('Slack gateway', () => {
  it('asks for the three bot scopes on Add to Slack', () => {
    const url = new URL(
      createSlackGateway(() => SLACK_CONFIG, vi.fn()).authorizeUrl('st'),
    );

    expect(url.origin + url.pathname).toBe(
      'https://slack.com/oauth/v2/authorize',
    );
    expect(url.searchParams.get('scope')).toBe(
      'chat:write,im:write,users:read',
    );
    expect(url.searchParams.get('state')).toBe('st');
    expect(url.searchParams.get('redirect_uri')).toBe(SLACK_CONFIG.redirectUri);
  });

  it('turns the OAuth answer into an install and the installing user', async () => {
    const fetchImpl = fetchReturning(
      json({
        ok: true,
        access_token: 'xoxb-1',
        bot_user_id: 'B1',
        team: { id: 'T1', name: 'NAIC' },
        authed_user: { id: 'U9' },
      }),
    );

    const install = await createSlackGateway(
      () => SLACK_CONFIG,
      fetchImpl,
    ).exchangeCode('code-1');

    expect(install).toEqual({
      teamId: 'T1',
      teamName: 'NAIC',
      botUserId: 'B1',
      botToken: 'xoxb-1',
      authedUserId: 'U9',
    });
    expect(formOf(fetchImpl.mock.calls[0][1])).toMatchObject({
      code: 'code-1',
      client_secret: 'secret',
    });
  });

  it('opens the DM, posts blocks with buttons and returns where it landed', async () => {
    const fetchImpl = fetchReturning(
      json({ ok: true, channel: { id: 'D1' } }),
      json({ ok: true, channel: 'D1', ts: '1.2' }),
    );

    const ref = await createSlackGateway(
      () => SLACK_CONFIG,
      fetchImpl,
    ).postMessage('xoxb-1', 'U1', {
      text: 'hello',
      buttons: [
        { text: 'Join', actionId: 'bell_join', url: 'https://meet' },
        {
          text: 'Acknowledge',
          actionId: 'bell_ack',
          value: 'e1',
          primary: true,
        },
      ],
    });

    expect(ref).toEqual({ channel: 'D1', ts: '1.2' });
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://slack.com/api/conversations.open',
    );
    const posted = JSON.parse(String(fetchImpl.mock.calls[1][1]?.body));
    expect(fetchImpl.mock.calls[1][1]?.headers).toMatchObject({
      Authorization: 'Bearer xoxb-1',
    });
    expect(posted.channel).toBe('D1');
    expect(posted.blocks[1].elements).toEqual([
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Join' },
        action_id: 'bell_join',
        url: 'https://meet',
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Acknowledge' },
        action_id: 'bell_ack',
        value: 'e1',
        style: 'primary',
      },
    ]);
  });

  it('throws what Slack says when it refuses', async () => {
    const fetchImpl = fetchReturning(
      json({ ok: false, error: 'not_in_channel' }),
    );

    await expect(
      createSlackGateway(() => SLACK_CONFIG, fetchImpl).updateMessage(
        'xoxb-1',
        { channel: 'D1', ts: '1.2' },
        { text: 'x', buttons: [] },
      ),
    ).rejects.toThrow('Slack: not_in_channel');
  });

  it('reads stored message references', () => {
    expect(decodeSlackRef('D1|1.2')).toEqual({ channel: 'D1', ts: '1.2' });
    expect(decodeSlackRef(null)).toBeNull();
    expect(decodeSlackRef('garbage')).toBeNull();
  });
});

describe('Slack request signatures', () => {
  const sign = (timestamp: string, body: string) =>
    `v0=${createHmac('sha256', 'signing').update(`v0:${timestamp}:${body}`).digest('hex')}`;

  it('accepts a fresh, correctly signed request', () => {
    expect(
      verifySlackSignature({
        signingSecret: 'signing',
        timestamp: '1000',
        body: 'payload=x',
        signature: sign('1000', 'payload=x'),
        nowSeconds: 1100,
      }),
    ).toBe(true);
  });

  it('refuses a stale, tampered or unsigned request', () => {
    const base = {
      signingSecret: 'signing',
      timestamp: '1000',
      body: 'payload=x',
      signature: sign('1000', 'payload=x'),
      nowSeconds: 1100,
    };

    expect(verifySlackSignature({ ...base, nowSeconds: 1400 })).toBe(false);
    expect(verifySlackSignature({ ...base, body: 'payload=y' })).toBe(false);
    expect(verifySlackSignature({ ...base, signature: null })).toBe(false);
  });
});

describe('Pushover gateway', () => {
  it('sends the emergency push with retry, expiry and the receipt callback', () => {
    expect(
      pushoverForm('app-token', {
        user: 'user-key',
        title: 'Client sync',
        message: 'in 2 minutes',
        priority: 2,
        url: 'https://meet',
        callback: 'https://bell.test/api/webhooks/pushover?n=1&sig=s',
      }),
    ).toEqual({
      token: 'app-token',
      user: 'user-key',
      title: 'Client sync',
      message: 'in 2 minutes',
      priority: '2',
      url: 'https://meet',
      url_title: 'Join',
      retry: '30',
      expire: '600',
      callback: 'https://bell.test/api/webhooks/pushover?n=1&sig=s',
    });
  });

  it('leaves retry and callback off a normal push', () => {
    const form = pushoverForm('t', {
      user: 'u',
      title: 't',
      message: 'm',
      priority: 0,
      url: null,
      callback: 'ignored',
    });

    expect(form).not.toHaveProperty('retry');
    expect(form).not.toHaveProperty('callback');
    expect(form).not.toHaveProperty('url');
  });

  it('returns the receipt and cancels it later', async () => {
    const fetchImpl = fetchReturning(
      json({ status: 1, request: 'r', receipt: 'receipt-1' }),
      json({ status: 1, request: 'r' }),
    );
    const gateway = createPushoverGateway(
      () => ({ appToken: 'app-token' }),
      fetchImpl,
    );

    const sent = await gateway.send({
      user: 'u',
      title: 't',
      message: 'm',
      priority: 2,
      url: null,
      callback: null,
    });
    await gateway.cancelReceipt('receipt-1');

    expect(sent).toEqual({ receipt: 'receipt-1' });
    expect(fetchImpl.mock.calls[1][0]).toBe(
      'https://api.pushover.net/1/receipts/receipt-1/cancel.json',
    );
  });

  it('throws Pushover errors', async () => {
    const fetchImpl = fetchReturning(
      json({ status: 0, errors: ['user identifier is not valid'] }, 400),
    );

    await expect(
      createPushoverGateway(() => ({ appToken: 't' }), fetchImpl).send({
        user: 'bad',
        title: 't',
        message: 'm',
        priority: 0,
        url: null,
        callback: null,
      }),
    ).rejects.toThrow('Pushover: user identifier is not valid');
  });
});

describe('Twilio gateway', () => {
  const config = () => ({
    accountSid: 'AC1',
    authToken: 'token',
    fromNumber: '+15125550000',
  });

  it('texts from the Bell number with basic auth', async () => {
    const fetchImpl = fetchReturning(json({ sid: 'SM1' }, 201));

    const sid = await createTwilioGateway(config, fetchImpl).sendSms(
      '+15125550100',
      'hello',
    );

    expect(sid).toBe('SM1');
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json',
    );
    expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from('AC1:token').toString('base64')}`,
    });
    expect(formOf(fetchImpl.mock.calls[0][1])).toEqual({
      From: '+15125550000',
      To: '+15125550100',
      Body: 'hello',
    });
  });

  it('places a call with inline TwiML and surfaces Twilio errors', async () => {
    const fetchImpl = fetchReturning(
      json({ message: "The 'To' number is not a valid phone number." }, 400),
    );

    await expect(
      createTwilioGateway(config, fetchImpl).call('+1', '<Response/>'),
    ).rejects.toThrow("Twilio: The 'To' number is not a valid phone number.");
    expect(formOf(fetchImpl.mock.calls[0][1]).Twiml).toBe('<Response/>');
  });

  it('builds a call that reads the reminder and gathers one key', () => {
    const twiml = reminderCallTwiml(
      'Bell reminder. Q&A <prep> is starting now.',
      'https://bell.test/api/webhooks/twilio/voice?n=1',
    );

    expect(twiml).toContain(
      '<Gather input="dtmf" numDigits="1" timeout="10" method="POST" action="https://bell.test/api/webhooks/twilio/voice?n=1">',
    );
    expect(twiml).toContain('Q&amp;A &lt;prep&gt; is starting now.');
  });

  it('verifies request signatures over the URL and sorted params', () => {
    const url = 'https://bell.test/api/webhooks/twilio/sms';
    const params = { From: '+15125550100', Body: 'ok' };
    const signature = twilioSignature('token', url, params);

    expect(
      verifyTwilioSignature({ authToken: 'token', url, params, signature }),
    ).toBe(true);
    expect(
      verifyTwilioSignature({
        authToken: 'token',
        url,
        params: { ...params, From: '+1999' },
        signature,
      }),
    ).toBe(false);
    expect(
      verifyTwilioSignature({
        authToken: 'token',
        url,
        params,
        signature: null,
      }),
    ).toBe(false);
  });
});
