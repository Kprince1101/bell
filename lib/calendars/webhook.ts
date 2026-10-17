import type { BellServices } from '@/lib/calendars/services';
import { verifySignedValue } from '@/lib/crypto/tokenCipher';
import { syncCalendar } from '@/lib/sync/syncCalendar';

export interface PushNotification {
  channelId: string | null;
  token: string | null;
  resourceId: string | null;
  resourceState: string | null;
}

export type PushOutcome =
  'synced' | 'acknowledged' | 'rejected' | 'unknown-channel' | 'sync-failed';

export const PUSH_OUTCOME_STATUS: Record<PushOutcome, number> = {
  synced: 200,
  acknowledged: 200,
  rejected: 401,
  'unknown-channel': 404,
  'sync-failed': 500,
};

const CHANNEL_HANDSHAKE_STATE = 'sync';

export const readPushNotification = (headers: Headers): PushNotification => ({
  channelId: headers.get('x-goog-channel-id'),
  token: headers.get('x-goog-channel-token'),
  resourceId: headers.get('x-goog-resource-id'),
  resourceState: headers.get('x-goog-resource-state'),
});

export const handlePushNotification = async (
  services: BellServices,
  notification: PushNotification,
): Promise<PushOutcome> => {
  const { channelId, token, resourceId, resourceState } = notification;
  const secret = services.config().webhookSecret;
  if (!channelId || !token || !verifySignedValue(channelId, token, secret)) {
    return 'rejected';
  }
  const calendar = await services.repo.calendarByChannel(channelId);
  if (
    !calendar?.active ||
    !resourceId ||
    calendar.channel_resource_id !== resourceId
  ) {
    return 'unknown-channel';
  }
  services.log(
    `[bell] push calendar=${calendar.id} channel=${channelId} state=${resourceState}`,
  );
  if (resourceState === CHANNEL_HANDSHAKE_STATE) return 'acknowledged';
  const outcome = await syncCalendar(services, calendar, 'webhook');
  if (!outcome.ok) return 'sync-failed';
  return 'synced';
};
