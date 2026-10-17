import { SYNC_TOKEN_GONE_STATUS, hasGoogleStatus } from '@/lib/google/errors';
import type { GoogleEvent, GoogleEventsPage } from '@/lib/google/schemas';
import { planDelta } from '@/lib/sync/normalize';
import { shiftDays } from '@/lib/sync/zonedTime';
import type { SyncMode, SyncDelta, SyncedEvent } from '@/types/calendar';
import type { EventsQuery } from '@/types/google';

export const SYNC_DAYS_BACK = 7;
export const SWEEP_MIN_DAYS_AHEAD = 60;
export const MAX_EVENT_PAGES = 40;

export type ListEventsPage = (query: EventsQuery) => Promise<GoogleEventsPage>;

export interface DeltaSource {
  syncToken: string | null;
  timeZone: string | null;
}

interface CollectedPages {
  items: GoogleEvent[];
  nextSyncToken: string;
  timeZone: string | null;
}

export const windowStart = (now: Date): string =>
  shiftDays(now, -SYNC_DAYS_BACK).toISOString();

export const fullSyncQuery = (now: Date): EventsQuery => ({
  timeMin: windowStart(now),
});

export const sweepEnd = (upserts: SyncedEvent[], now: Date): string => {
  const furthest = upserts.reduce(
    (latest, event) => Math.max(latest, Date.parse(event.starts_at)),
    shiftDays(now, SWEEP_MIN_DAYS_AHEAD).getTime(),
  );
  return new Date(furthest).toISOString();
};

const collectPages = async (
  listPage: ListEventsPage,
  query: EventsQuery,
): Promise<CollectedPages> => {
  const items: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let last: GoogleEventsPage;
  let pages = 0;
  do {
    if (pages === MAX_EVENT_PAGES) {
      throw new Error(
        `Google returned more than ${MAX_EVENT_PAGES} pages of events`,
      );
    }
    last = await listPage({ ...query, pageToken });
    pages += 1;
    items.push(...last.items);
    pageToken = last.nextPageToken;
  } while (pageToken);
  if (!last.nextSyncToken) throw new Error('Google returned no sync token');
  return {
    items,
    nextSyncToken: last.nextSyncToken,
    timeZone: last.timeZone ?? null,
  };
};

const buildDelta = (
  mode: SyncMode,
  pages: CollectedPages,
  source: DeltaSource,
  now: Date,
): SyncDelta => {
  const planned = planDelta(pages.items, pages.timeZone ?? source.timeZone);
  return {
    mode,
    ...planned,
    fromSyncToken: source.syncToken,
    nextSyncToken: pages.nextSyncToken,
    windowStart: windowStart(now),
    windowEnd: sweepEnd(planned.upserts, now),
    seenAt: now.toISOString(),
  };
};

const incrementalPages = async (
  listPage: ListEventsPage,
  syncToken: string | null,
): Promise<CollectedPages | null> => {
  if (!syncToken) return null;
  try {
    return await collectPages(listPage, { syncToken });
  } catch (err) {
    if (hasGoogleStatus(err, SYNC_TOKEN_GONE_STATUS)) return null;
    throw err;
  }
};

export const fetchDelta = async (
  listPage: ListEventsPage,
  source: DeltaSource,
  now: Date,
): Promise<SyncDelta> => {
  const incremental = await incrementalPages(listPage, source.syncToken);
  if (incremental) return buildDelta('incremental', incremental, source, now);
  const full = await collectPages(listPage, fullSyncQuery(now));
  return buildDelta('full', full, source, now);
};
