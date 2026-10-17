import { z } from 'zod';
import { acknowledgeEvent } from '@/lib/notify/acknowledge';
import type { NotifyServices } from '@/lib/notify/services';
import { SLACK_ACK_ACTION, verifySlackSignature } from '@/lib/notify/slack';
import {
  twimlMessage,
  twimlResponse,
  twimlSay,
  verifyTwilioSignature,
} from '@/lib/notify/twilio';
import {
  pushoverCallbackBody,
  slackActionPayload,
} from '@/lib/schemas/notifications';

export type WebhookOutcome = 'acknowledged' | 'ignored' | 'rejected';

export const WEBHOOK_STATUS: Record<WebhookOutcome, number> = {
  acknowledged: 200,
  ignored: 200,
  rejected: 401,
};

export interface TwimlReply {
  outcome: WebhookOutcome;
  twiml: string;
}

export interface SignedSlackRequest {
  body: string;
  timestamp: string | null;
  signature: string | null;
}

export interface SignedTwilioRequest {
  url: string;
  params: Record<string, string>;
  signature: string | null;
}

const outcomeOf = (acknowledged: boolean): WebhookOutcome => {
  if (acknowledged) return 'acknowledged';
  return 'ignored';
};

const eventId = z.uuid();
const notificationId = z.uuid();

const readSlackPayload = (body: string) => {
  const raw = new URLSearchParams(body).get('payload');
  try {
    return slackActionPayload.safeParse(JSON.parse(raw ?? 'null')).data ?? null;
  } catch {
    return null;
  }
};

export const handleSlackInteraction = async (
  services: NotifyServices,
  signingSecret: string,
  request: SignedSlackRequest,
): Promise<WebhookOutcome> => {
  const verified = verifySlackSignature({
    signingSecret,
    timestamp: request.timestamp,
    body: request.body,
    signature: request.signature,
    nowSeconds: Math.floor(services.now().getTime() / 1000),
  });
  if (!verified) return 'rejected';
  const payload = readSlackPayload(request.body);
  const action = payload?.actions.find(
    (candidate) => candidate.action_id === SLACK_ACK_ACTION,
  );
  const event = eventId.safeParse(action?.value);
  if (!payload || !event.success) return 'ignored';
  const userId = await services.repo.slackEventOwner(
    event.data,
    payload.team.id,
    payload.user.id,
  );
  if (!userId) return 'ignored';
  await acknowledgeEvent(
    services,
    { eventId: event.data, userId },
    `slack:${payload.user.id}`,
  );
  return 'acknowledged';
};

const verifyTwilio = (authToken: string, request: SignedTwilioRequest) =>
  verifyTwilioSignature({ authToken, ...request });

export const SMS_REPLIES: Record<WebhookOutcome, string> = {
  acknowledged: 'Bell: acknowledged. Nothing else will ring for that meeting.',
  ignored: 'Bell: there is nothing to acknowledge right now.',
  rejected: '',
};

export const handleTwilioSms = async (
  services: NotifyServices,
  authToken: string,
  request: SignedTwilioRequest,
): Promise<TwimlReply> => {
  if (!verifyTwilio(authToken, request)) {
    return { outcome: 'rejected', twiml: twimlResponse() };
  }
  const from = request.params.From ?? '';
  const targets = await services.repo.ackTargetsForPhone(
    from,
    services.now().toISOString(),
  );
  await Promise.all(
    targets.map((target) => acknowledgeEvent(services, target, `sms:${from}`)),
  );
  const outcome = outcomeOf(targets.length > 0);
  return { outcome, twiml: twimlResponse(twimlMessage(SMS_REPLIES[outcome])) };
};

export const VOICE_REPLIES: Record<WebhookOutcome, string> = {
  acknowledged: 'Acknowledged. Goodbye.',
  ignored: 'Goodbye.',
  rejected: '',
};

export const handleTwilioVoice = async (
  services: NotifyServices,
  authToken: string,
  request: SignedTwilioRequest,
  rawNotificationId: string | null,
): Promise<TwimlReply> => {
  if (!verifyTwilio(authToken, request)) {
    return { outcome: 'rejected', twiml: twimlResponse() };
  }
  const id = notificationId.safeParse(rawNotificationId);
  const pressed = Boolean(request.params.Digits);
  const owner =
    (pressed &&
      id.success &&
      (await services.repo.notificationOwner(id.data))) ||
    null;
  if (owner) {
    await acknowledgeEvent(services, owner, `voice:${owner.target ?? 'call'}`);
  }
  const outcome = outcomeOf(Boolean(owner));
  return { outcome, twiml: twimlResponse(twimlSay(VOICE_REPLIES[outcome])) };
};

export interface PushoverCallback {
  notificationId: string | null;
  signature: string | null;
  form: Record<string, string>;
}

export const handlePushoverCallback = async (
  services: NotifyServices,
  callback: PushoverCallback,
): Promise<WebhookOutcome> => {
  const id = notificationId.safeParse(callback.notificationId);
  if (
    !id.success ||
    !callback.signature ||
    !services.links.verifyPushover(id.data, callback.signature)
  ) {
    return 'rejected';
  }
  const body = pushoverCallbackBody.safeParse(callback.form);
  if (!body.success || body.data.acknowledged !== '1') return 'ignored';
  const owner = await services.repo.notificationOwner(id.data);
  if (!owner || owner.providerRef !== body.data.receipt) return 'ignored';
  await acknowledgeEvent(
    services,
    owner,
    `pushover:${body.data.acknowledged_by ?? owner.target ?? 'user'}`,
  );
  return 'acknowledged';
};
