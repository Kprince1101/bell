import { randomUUID } from 'node:crypto';
import type { BellServices } from '@/lib/calendars/services';
import { signValue } from '@/lib/crypto/tokenCipher';
import { isAlreadyGone } from '@/lib/google/errors';
import type { CalendarChannel, CalendarRow } from '@/types/calendar';

export const CHANNEL_TTL_SECONDS = 7 * 24 * 60 * 60;

const fallbackExpiry = (now: Date): number =>
  now.getTime() + CHANNEL_TTL_SECONDS * 1000;

export const startWatch = async (
  services: BellServices,
  calendar: CalendarRow,
): Promise<CalendarChannel> => {
  const { google, repo, log } = services;
  const config = services.config();
  const accessToken = await services.accessToken(calendar.account_id);
  const channelId = randomUUID();
  const response = await google.watchEvents(
    accessToken,
    calendar.google_calendar_id,
    {
      id: channelId,
      token: signValue(channelId, config.webhookSecret),
      address: config.webhookUrl,
      ttlSeconds: CHANNEL_TTL_SECONDS,
    },
  );
  const channel = {
    channelId,
    resourceId: response.resourceId,
    expiresAt: new Date(
      response.expiration ?? fallbackExpiry(services.now()),
    ).toISOString(),
  };
  await repo.saveChannel(calendar, channel);
  log(
    `[bell] watch calendar=${calendar.id} channel=${channelId} expires=${channel.expiresAt}`,
  );
  return channel;
};

export const stopWatch = async (
  services: BellServices,
  calendar: CalendarRow,
): Promise<void> => {
  if (!calendar.channel_id || !calendar.channel_resource_id) return;
  try {
    const accessToken = await services.accessToken(calendar.account_id);
    await services.google.stopChannel(accessToken, {
      id: calendar.channel_id,
      resourceId: calendar.channel_resource_id,
    });
  } catch (err) {
    if (!isAlreadyGone(err)) throw err;
  }
  services.log(
    `[bell] unwatch calendar=${calendar.id} channel=${calendar.channel_id}`,
  );
};
