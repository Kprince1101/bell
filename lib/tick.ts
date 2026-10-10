import { renewChannels } from '@/lib/calendars/renewal';
import type { RenewalReport } from '@/lib/calendars/renewal';
import type { BellServices } from '@/lib/calendars/services';
import { safeEqual } from '@/lib/crypto/tokenCipher';

export interface TickReport {
  channels: RenewalReport;
}

export const isAuthorizedTick = (
  authorization: string | null,
  secret: string | undefined,
): boolean => {
  if (!secret || !authorization) return false;
  return safeEqual(`Bearer ${secret}`, authorization);
};

export const runTick = async (services: BellServices): Promise<TickReport> => {
  const channels = await renewChannels(services);
  services.log(
    `[bell] tick renewed=${channels.renewed.length} failed=${channels.failed.length} push-stopped=${channels.pushStopped.length}`,
  );
  return { channels };
};
