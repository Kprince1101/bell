import type { BellServices } from '@/lib/calendars/services';
import { getErrorMessage } from '@/lib/errors';
import { fetchDelta } from '@/lib/sync/delta';
import type { CalendarRow, SyncDelta, SyncTrigger } from '@/types/calendar';

export type SyncOutcome =
  { ok: true; delta: SyncDelta } | { ok: false; error: string };

export const syncCalendar = async (
  services: BellServices,
  calendar: CalendarRow,
  trigger: SyncTrigger,
): Promise<SyncOutcome> => {
  const { google, repo, log } = services;
  try {
    const accessToken = await services.accessToken(calendar.account_id);
    const delta = await fetchDelta(
      (query) =>
        google.listEvents(accessToken, calendar.google_calendar_id, query),
      { syncToken: calendar.sync_token, timeZone: calendar.time_zone },
      services.now(),
    );
    await repo.applySync(calendar.id, delta);
    log(
      `[bell] sync calendar=${calendar.id} trigger=${trigger} mode=${delta.mode} upserts=${delta.upserts.length} cancelled=${delta.cancelled.length}`,
    );
    return { ok: true, delta };
  } catch (err) {
    const error = getErrorMessage(err);
    await repo.recordFailure(calendar.id, error);
    log(
      `[bell] sync-failed calendar=${calendar.id} trigger=${trigger} error=${error}`,
    );
    return { ok: false, error };
  }
};
