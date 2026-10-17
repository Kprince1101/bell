import type { BellServices } from '@/lib/calendars/services';
import { getErrorMessage } from '@/lib/errors';
import { fetchDelta } from '@/lib/sync/delta';
import type { CalendarRow, SyncDelta, SyncTrigger } from '@/types/calendar';

export type SyncOutcome =
  | { ok: true; applied: boolean; delta: SyncDelta }
  | { ok: false; error: string };

export const OVERTAKEN_SYNC_ATTEMPTS = 2;

const calendarToRetry = async (
  services: BellServices,
  calendarId: string,
  attempt: number,
): Promise<CalendarRow | null> => {
  if (attempt >= OVERTAKEN_SYNC_ATTEMPTS) return null;
  const latest = await services.repo.calendarById(calendarId);
  if (!latest?.active || !latest.sync_token) return null;
  return latest;
};

export const syncCalendar = async (
  services: BellServices,
  calendar: CalendarRow,
  trigger: SyncTrigger,
): Promise<SyncOutcome> => {
  const { google, repo, log } = services;
  try {
    const accessToken = await services.accessToken(calendar.account_id);
    let current = calendar;
    for (let attempt = 1; ; attempt += 1) {
      const delta = await fetchDelta(
        (query) =>
          google.listEvents(accessToken, current.google_calendar_id, query),
        { syncToken: current.sync_token, timeZone: current.time_zone },
        services.now(),
      );
      if (await repo.applySync(current.id, delta)) {
        log(
          `[bell] sync calendar=${calendar.id} trigger=${trigger} mode=${delta.mode} upserts=${delta.upserts.length} cancelled=${delta.cancelled.length}`,
        );
        return { ok: true, applied: true, delta };
      }
      log(
        `[bell] sync-skipped calendar=${calendar.id} trigger=${trigger} reason=sync-token-changed attempt=${attempt}`,
      );
      const latest = await calendarToRetry(services, calendar.id, attempt);
      if (!latest) return { ok: true, applied: false, delta };
      current = latest;
    }
  } catch (err) {
    const error = getErrorMessage(err);
    await repo.recordFailure(calendar.id, error);
    log(
      `[bell] sync-failed calendar=${calendar.id} trigger=${trigger} error=${error}`,
    );
    return { ok: false, error };
  }
};
