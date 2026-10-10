import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { safeEqual } from '@/lib/crypto/tokenCipher';
import type { SlackConfig } from '@/lib/notify/config';
import { ProviderError, parseProvider, readJson } from '@/lib/notify/http';
import type { Fetch } from '@/lib/notify/http';
import type {
  SlackGateway,
  SlackMessage,
  SlackMessageRef,
} from '@/types/notifications';

export const SLACK_SCOPES = ['chat:write', 'im:write', 'users:read'];
export const SLACK_ACK_ACTION = 'bell_ack';
export const SLACK_JOIN_ACTION = 'bell_join';
export const SLACK_SIGNATURE_MAX_AGE_SECONDS = 300;

const AUTHORIZE_URL = 'https://slack.com/oauth/v2/authorize';
const API = 'https://slack.com/api';

const slackError = z.object({ ok: z.literal(false), error: z.string() });

const oauthResponse = z.object({
  ok: z.literal(true),
  access_token: z.string(),
  bot_user_id: z.string(),
  team: z.object({ id: z.string(), name: z.string() }),
  authed_user: z.object({ id: z.string() }),
});

const openResponse = z.object({
  ok: z.literal(true),
  channel: z.object({ id: z.string() }),
});

const postResponse = z.object({
  ok: z.literal(true),
  channel: z.string(),
  ts: z.string(),
});

const okResponse = z.object({ ok: z.literal(true) });

const slackRequest = async (
  fetchImpl: Fetch,
  method: string,
  init: RequestInit,
): Promise<unknown> => {
  const response = await fetchImpl(`${API}/${method}`, {
    method: 'POST',
    ...init,
  });
  const body = await readJson(response);
  const failed = slackError.safeParse(body);
  if (failed.success) throw new ProviderError('Slack', failed.data.error);
  if (!response.ok) throw new ProviderError('Slack', `HTTP ${response.status}`);
  return body;
};

const botCall = (
  fetchImpl: Fetch,
  botToken: string,
  method: string,
  payload: Record<string, unknown>,
) =>
  slackRequest(fetchImpl, method, {
    headers: {
      Authorization: `Bearer ${botToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

export const slackBlocks = (message: SlackMessage): unknown[] => {
  const blocks: unknown[] = [
    { type: 'section', text: { type: 'mrkdwn', text: message.text } },
  ];
  if (!message.buttons.length) return blocks;
  blocks.push({
    type: 'actions',
    elements: message.buttons.map((button) => ({
      type: 'button',
      text: { type: 'plain_text', text: button.text },
      action_id: button.actionId,
      ...(button.url && { url: button.url }),
      ...(button.value && { value: button.value }),
      ...(button.primary && { style: 'primary' }),
    })),
  });
  return blocks;
};

export const encodeSlackRef = (ref: SlackMessageRef): string =>
  `${ref.channel}|${ref.ts}`;

export const decodeSlackRef = (
  value: string | null,
): SlackMessageRef | null => {
  const [channel, ts] = (value ?? '').split('|');
  if (!channel || !ts) return null;
  return { channel, ts };
};

export const verifySlackSignature = ({
  signingSecret,
  timestamp,
  body,
  signature,
  nowSeconds,
}: {
  signingSecret: string;
  timestamp: string | null;
  body: string;
  signature: string | null;
  nowSeconds: number;
}): boolean => {
  if (!timestamp || !signature) return false;
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) return false;
  if (Math.abs(nowSeconds - sentAt) > SLACK_SIGNATURE_MAX_AGE_SECONDS) {
    return false;
  }
  const expected = `v0=${createHmac('sha256', signingSecret)
    .update(`v0:${timestamp}:${body}`)
    .digest('hex')}`;
  return safeEqual(expected, signature);
};

export const createSlackGateway = (
  config: () => SlackConfig,
  fetchImpl: Fetch = fetch,
): SlackGateway => ({
  authorizeUrl: (state) => {
    const url = new URL(AUTHORIZE_URL);
    url.search = new URLSearchParams({
      client_id: config().clientId,
      scope: SLACK_SCOPES.join(','),
      redirect_uri: config().redirectUri,
      state,
    }).toString();
    return url.toString();
  },

  exchangeCode: async (code) => {
    const body = parseProvider(
      'Slack',
      oauthResponse,
      await slackRequest(fetchImpl, 'oauth.v2.access', {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config().clientId,
          client_secret: config().clientSecret,
          code,
          redirect_uri: config().redirectUri,
        }),
      }),
    );
    return {
      teamId: body.team.id,
      teamName: body.team.name,
      botUserId: body.bot_user_id,
      botToken: body.access_token,
      authedUserId: body.authed_user.id,
    };
  },

  postMessage: async (botToken, slackUserId, message) => {
    const opened = parseProvider(
      'Slack',
      openResponse,
      await botCall(fetchImpl, botToken, 'conversations.open', {
        users: slackUserId,
      }),
    );
    const posted = parseProvider(
      'Slack',
      postResponse,
      await botCall(fetchImpl, botToken, 'chat.postMessage', {
        channel: opened.channel.id,
        text: message.text,
        blocks: slackBlocks(message),
      }),
    );
    return { channel: posted.channel, ts: posted.ts };
  },

  updateMessage: async (botToken, ref, message) => {
    parseProvider(
      'Slack',
      okResponse,
      await botCall(fetchImpl, botToken, 'chat.update', {
        channel: ref.channel,
        ts: ref.ts,
        text: message.text,
        blocks: slackBlocks(message),
      }),
    );
  },
});
