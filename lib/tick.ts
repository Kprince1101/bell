import { renewChannels } from '@/lib/calendars/renewal';
import type { RenewalReport } from '@/lib/calendars/renewal';
import type { BellServices } from '@/lib/calendars/services';
import { safeEqual } from '@/lib/crypto/tokenCipher';
import { runNotify } from '@/lib/notify/engine';
import type { NotifyReport } from '@/lib/notify/engine';
import type { NotifyServices } from '@/lib/notify/services';

export interface TickReport {
  notifications: NotifyReport;
  channels: RenewalReport;
}

export const isAuthorizedTick = (
  authorization: string | null,
  secret: string | undefined,
): boolean => {
  if (!secret || !authorization) return false;
  return safeEqual(`Bearer ${secret}`, authorization);
};

export const runTick = async (
  services: BellServices,
  notify: NotifyServices,
): Promise<TickReport> => {
  const [notifications, channels] = await Promise.allSettled([
    runNotify(notify),
    renewChannels(services),
  ]);
  if (notifications.status === 'rejected') throw notifications.reason;
  if (channels.status === 'rejected') throw channels.reason;
  services.log(
    `[bell] tick renewed=${channels.value.renewed.length} failed=${channels.value.failed.length} push-stopped=${channels.value.pushStopped.length}`,
  );
  return { notifications: notifications.value, channels: channels.value };
};
