import { getErrorMessage } from '@/lib/errors';
import {
  TEST_MESSAGE,
  pushoverBody,
  slackReminder,
  smsBody,
  voiceScript,
} from '@/lib/notify/messages';
import type { NotifyServices } from '@/lib/notify/services';
import { decodeSlackRef, encodeSlackRef } from '@/lib/notify/slack';
import {
  reminderCallTwiml,
  twimlResponse,
  twimlSay,
} from '@/lib/notify/twilio';
import type {
  ChannelKind,
  ChannelTarget,
  Delivery,
  SendOutcome,
} from '@/types/notifications';

type Sender = (
  services: NotifyServices,
  delivery: Delivery,
) => Promise<string | null>;
type TestSender = (
  services: NotifyServices,
  target: ChannelTarget,
) => Promise<void>;

const requireValue = (value: string | null, message: string): string => {
  if (!value) throw new Error(message);
  return value;
};

const slackToken = (services: NotifyServices, sealed: string | null): string =>
  services.decrypt(
    requireValue(sealed, 'Slack is not connected for this workspace'),
  );

const sendSlack: Sender = async (services, delivery) => {
  const token = slackToken(services, delivery.slack_bot_token);
  const message = slackReminder(delivery, services.now());
  const previous = decodeSlackRef(delivery.slack_ref);
  if (previous && delivery.step !== 'moved') {
    await services.slack.updateMessage(token, previous, message);
    return encodeSlackRef(previous);
  }
  const target = requireValue(delivery.target, 'No Slack user linked');
  return encodeSlackRef(
    await services.slack.postMessage(token, target, message),
  );
};

const sendPushover: Sender = async (services, delivery) => {
  const { receipt } = await services.pushover.send({
    user: requireValue(delivery.target, 'No Pushover key saved'),
    ...pushoverBody(delivery, services.now()),
    callback: services.links.pushoverCallback(delivery.id),
  });
  return receipt;
};

const sendSms: Sender = (services, delivery) =>
  services.twilio.sendSms(
    requireValue(delivery.target, 'No phone number saved'),
    smsBody(delivery, services.now()),
  );

const sendVoice: Sender = (services, delivery) =>
  services.twilio.call(
    requireValue(delivery.target, 'No phone number saved'),
    reminderCallTwiml(
      voiceScript(delivery, services.now()),
      services.links.voiceAction(delivery.id),
    ),
  );

const SENDERS: Record<ChannelKind, Sender> = {
  slack: sendSlack,
  pushover: sendPushover,
  sms: sendSms,
  voice: sendVoice,
};

export const attemptDelivery = async (
  services: NotifyServices,
  delivery: Delivery,
): Promise<SendOutcome> => {
  try {
    const providerRef = await SENDERS[delivery.channel](services, delivery);
    return { result: 'sent', error: null, providerRef };
  } catch (err) {
    return { result: 'failed', error: getErrorMessage(err), providerRef: null };
  }
};

const TEST_SENDERS: Record<ChannelKind, TestSender> = {
  slack: async (services, target) => {
    await services.slack.postMessage(
      slackToken(services, target.slack_bot_token),
      target.target,
      { text: `:bell: ${TEST_MESSAGE}`, buttons: [] },
    );
  },
  pushover: async (services, target) => {
    await services.pushover.send({
      user: target.target,
      title: 'Bell test',
      message: TEST_MESSAGE,
      priority: 0,
      url: null,
      callback: null,
    });
  },
  sms: async (services, target) => {
    await services.twilio.sendSms(target.target, `Bell: ${TEST_MESSAGE}`);
  },
  voice: async (services, target) => {
    await services.twilio.call(
      target.target,
      twimlResponse(twimlSay(`Hello from Bell. ${TEST_MESSAGE} Goodbye.`)),
    );
  },
};

export const sendTest = (
  services: NotifyServices,
  kind: ChannelKind,
  target: ChannelTarget,
): Promise<void> => TEST_SENDERS[kind](services, target);
