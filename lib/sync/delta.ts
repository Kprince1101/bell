import { SYNC_TOKEN_GONE_STATUS, hasGoogleStatus } from '@/lib/google/errors';
import type { GoogleEvent, GoogleEventsPage } from '@/lib/google/schemas';
import { planDelta } from '@/lib/sync/normalize';
import { shiftDays } from '@/lib/sync/zonedTime';
import type { SyncDelta, SyncMode, SyncWindow } from '@/types/calendar';
import type { EventsQuery } from '@/types/google';

export const SYNC_DAYS_BACK = 7;
export const SYNC_DAYS_AHEAD = 60;

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

export const syncWindow = (now: Date): SyncWindow => ({
  timeMin: shiftDays(now, -SYNC_DAYS_BACK).toISOString(),
  timeMax: shiftDays(now, SYNC_DAYS_AHEAD).toISOString(),
});

const collectPages = async (
  listPage: ListEventsPage,
  query: EventsQuery,
): Promise<CollectedPages> => {
  const items: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let last: GoogleEventsPage;
  do {
    last = await listPage({ ...query, pageToken });
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
  fallbackTimeZone: string | null,
  window: SyncWindow,
  now: Date,
): SyncDelta => ({
  mode,
  ...planDelta(pages.items, pages.timeZone ?? fallbackTimeZone),
  nextSyncToken: pages.nextSyncToken,
  windowStart: window.timeMin,
  seenAt: now.toISOString(),
});

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
  const window = syncWindow(now);
  const incremental = await incrementalPages(listPage, source.syncToken);
  if (incremental) {
    return buildDelta('incremental', incremental, source.timeZone, window, now);
  }
  const full = await collectPages(listPage, window);
  return buildDelta('full', full, source.timeZone, window, now);
};
