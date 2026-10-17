import { getErrorMessage } from '@/lib/errors';
import { slackAcknowledged } from '@/lib/notify/messages';
import type { NotifyServices } from '@/lib/notify/services';
import { decodeSlackRef } from '@/lib/notify/slack';
import type { AckTarget, ChannelKind, Delivery } from '@/types/notifications';

type Stopper = (services: NotifyServices, delivery: Delivery) => Promise<void>;

const stopSlack: Stopper = async (services, delivery) => {
  const ref = decodeSlackRef(delivery.provider_ref);
  if (!ref || !delivery.slack_bot_token) return;
  await services.slack.updateMessage(
    services.decrypt(delivery.slack_bot_token),
    ref,
    slackAcknowledged(delivery),
  );
};

const stopPushover: Stopper = async (services, delivery) => {
  if (!delivery.provider_ref) return;
  await services.pushover.cancelReceipt(delivery.provider_ref);
};

const nothingToStop: Stopper = async () => undefined;

const STOPPERS: Record<ChannelKind, Stopper> = {
  slack: stopSlack,
  pushover: stopPushover,
  sms: nothingToStop,
  voice: nothingToStop,
};

const stopDelivery = async (
  services: NotifyServices,
  delivery: Delivery,
): Promise<void> => {
  try {
    await STOPPERS[delivery.channel](services, delivery);
  } catch (err) {
    services.log(
      `[bell] ack-stop-failed notification=${delivery.id} channel=${delivery.channel} error=${getErrorMessage(err)}`,
    );
  }
};

export const acknowledgeEvent = async (
  services: NotifyServices,
  target: AckTarget,
  by: string,
): Promise<void> => {
  const sent = await services.repo.acknowledge(
    target,
    by,
    services.now().toISOString(),
  );
  const distinct = new Map(
    sent.map((delivery) => [
      `${delivery.channel}:${delivery.provider_ref}`,
      delivery,
    ]),
  );
  await Promise.all(
    [...distinct.values()].map((delivery) => stopDelivery(services, delivery)),
  );
  services.log(
    `[bell] ack event=${target.eventId} by=${by} stopped=${sent.length}`,
  );
};
