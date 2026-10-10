import type { BellServices } from '@/lib/calendars/services';
import { startWatch, stopWatch } from '@/lib/calendars/watch';
import { getErrorMessage } from '@/lib/errors';
import type { CalendarRow } from '@/types/calendar';

export const RENEW_WITHIN_MS = 24 * 60 * 60 * 1000;

export interface RenewalReport {
  renewed: string[];
  failed: string[];
  pushStopped: string[];
}

const retireChannel = async (
  services: BellServices,
  calendar: CalendarRow,
): Promise<void> => {
  try {
    await stopWatch(services, calendar);
  } catch (err) {
    services.log(
      `[bell] unwatch-failed calendar=${calendar.id} channel=${calendar.channel_id} error=${getErrorMessage(err)}`,
    );
  }
};

const renewOne = async (
  services: BellServices,
  calendar: CalendarRow,
): Promise<boolean> => {
  try {
    await startWatch(services, calendar);
  } catch (err) {
    const error = `Watch renewal failed: ${getErrorMessage(err)}`;
    await services.repo.recordFailure(calendar.id, error);
    services.log(`[bell] renew-failed calendar=${calendar.id} error=${error}`);
    return false;
  }
  await retireChannel(services, calendar);
  return true;
};

export const renewChannels = async (
  services: BellServices,
): Promise<RenewalReport> => {
  const now = services.now();
  const due = await services.repo.calendarsDueForRenewal(
    new Date(now.getTime() + RENEW_WITHIN_MS).toISOString(),
  );
  const renewed: string[] = [];
  const failed: string[] = [];
  for (const calendar of due) {
    const ok = await renewOne(services, calendar);
    if (ok) renewed.push(calendar.id);
    if (!ok) failed.push(calendar.id);
  }
  const pushStopped = await services.repo.markPushStopped(now.toISOString());
  return { renewed, failed, pushStopped };
};
