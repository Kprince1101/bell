import { GoogleApiError } from '@/lib/google/errors';
import {
  MAX_EVENT_PAGES,
  fetchDelta,
  fullSyncQuery,
  sweepEnd,
} from '@/lib/sync/delta';
import { planDelta } from '@/lib/sync/normalize';
import { syncCalendar } from '@/lib/sync/syncCalendar';
import {
  ACCOUNT_ID,
  CALENDAR_ID,
  NOW,
  calendarRow,
  createFakeServices,
  eventsPage,
  fakeEventsList,
} from '@/test-utils/calendarFakes';
import {
  FAR_FUTURE,
  OFFSITE,
  STANDUP,
  STANDUP_DELETED,
  STANDUP_MOVED,
  WEEKLY_SERIES_DELETED,
  weeklySeries,
} from '@/test-utils/googleFixtures';

const WINDOW = { timeMin: '2026-10-03T12:00:00.000Z' };
const SWEEP_FLOOR = '2026-12-09T12:00:00.000Z';

describe('fullSyncQuery', () => {
  it('asks for everything ending after 7 days ago, with no upper bound', () => {
    expect(fullSyncQuery(NOW)).toEqual(WINDOW);
  });
});

describe('sweepEnd', () => {
  it('reaches the furthest start returned, and at least 60 days ahead', () => {
    const [far] = planDelta([FAR_FUTURE], 'UTC').upserts;
    const [near] = planDelta([STANDUP], 'UTC').upserts;

    expect(sweepEnd([], NOW)).toBe(SWEEP_FLOOR);
    expect(sweepEnd([near], NOW)).toBe(SWEEP_FLOOR);
    expect(sweepEnd([near, far], NOW)).toBe('2027-01-20T15:00:00.000Z');
  });
});

describe('fetchDelta', () => {
  it('fetches an open-ended series beyond day 60, across every page', async () => {
    const series = weeklySeries('2026-07-01T14:00:00Z', 52);
    const listPage = vi.fn(fakeEventsList(series, 10));

    const delta = await fetchDelta(
      listPage,
      { syncToken: null, timeZone: 'UTC' },
      NOW,
    );

    const starts = delta.upserts.map((event) => event.starts_at);
    expect(listPage).toHaveBeenCalledTimes(4);
    listPage.mock.calls.forEach(([query]) => {
      expect(query).not.toHaveProperty('timeMax');
      expect(query.timeMin).toBe(WINDOW.timeMin);
    });
    expect(starts).toHaveLength(38);
    expect(starts.filter((start) => start >= SWEEP_FLOOR)).toHaveLength(29);
    expect(starts.at(-1)).toBe('2027-06-23T14:00:00.000Z');
    expect(delta).toMatchObject({
      mode: 'full',
      nextSyncToken: 'sync-full',
      windowEnd: '2027-06-23T14:00:00.000Z',
    });
  });

  it('fails visibly instead of paging forever', async () => {
    const listPage = vi
      .fn()
      .mockResolvedValue(
        eventsPage({ nextPageToken: 'more', nextSyncToken: undefined }),
      );

    await expect(
      fetchDelta(listPage, { syncToken: null, timeZone: 'UTC' }, NOW),
    ).rejects.toThrow(`more than ${MAX_EVENT_PAGES} pages`);
    expect(listPage).toHaveBeenCalledTimes(MAX_EVENT_PAGES);
  });

  it('does a full sync across pages when there is no sync token', async () => {
    const listPage = vi
      .fn()
      .mockResolvedValueOnce(
        eventsPage({
          items: [STANDUP],
          nextPageToken: 'p2',
          nextSyncToken: undefined,
        }),
      )
      .mockResolvedValueOnce(
        eventsPage({ items: [OFFSITE], nextSyncToken: 'sync-9' }),
      );

    const delta = await fetchDelta(
      listPage,
      { syncToken: null, timeZone: 'UTC' },
      NOW,
    );

    expect(listPage).toHaveBeenNthCalledWith(1, {
      ...WINDOW,
      pageToken: undefined,
    });
    expect(listPage).toHaveBeenNthCalledWith(2, { ...WINDOW, pageToken: 'p2' });
    expect(delta).toMatchObject({
      mode: 'full',
      fromSyncToken: null,
      nextSyncToken: 'sync-9',
      windowStart: WINDOW.timeMin,
      windowEnd: SWEEP_FLOOR,
      seenAt: NOW.toISOString(),
      cancelled: [],
    });
    expect(delta.upserts.map((event) => event.event_id)).toEqual([
      'standup',
      'offsite',
    ]);
  });

  it('pulls only the delta with the stored sync token', async () => {
    const listPage = vi
      .fn()
      .mockResolvedValue(
        eventsPage({ items: [STANDUP_MOVED, WEEKLY_SERIES_DELETED] }),
      );

    const delta = await fetchDelta(
      listPage,
      { syncToken: 'sync-1', timeZone: 'UTC' },
      NOW,
    );

    expect(listPage).toHaveBeenCalledTimes(1);
    expect(listPage).toHaveBeenCalledWith({
      syncToken: 'sync-1',
      pageToken: undefined,
    });
    expect(delta.mode).toBe('incremental');
    expect(delta.fromSyncToken).toBe('sync-1');
    expect(delta.upserts[0].starts_at).toBe('2026-10-12T15:00:00.000Z');
    expect(delta.cancelled).toEqual(['weekly']);
    expect(delta.nextSyncToken).toBe('sync-2');
  });

  it('falls back to a full resync when Google says the token is gone (410)', async () => {
    const listPage = vi
      .fn()
      .mockRejectedValueOnce(
        new GoogleApiError(410, 'Google 410: Sync token is no longer valid'),
      )
      .mockResolvedValueOnce(
        eventsPage({ items: [STANDUP], nextSyncToken: 'fresh' }),
      );

    const delta = await fetchDelta(
      listPage,
      { syncToken: 'stale', timeZone: 'UTC' },
      NOW,
    );

    expect(listPage).toHaveBeenNthCalledWith(2, {
      ...WINDOW,
      pageToken: undefined,
    });
    expect(delta.mode).toBe('full');
    expect(delta.fromSyncToken).toBe('stale');
    expect(delta.nextSyncToken).toBe('fresh');
  });

  it('surfaces other Google errors', async () => {
    const listPage = vi
      .fn()
      .mockRejectedValue(new GoogleApiError(500, 'Google 500'));

    await expect(
      fetchDelta(listPage, { syncToken: 'sync-1', timeZone: 'UTC' }, NOW),
    ).rejects.toThrow('Google 500');
    expect(listPage).toHaveBeenCalledTimes(1);
  });

  it('refuses a final page without a sync token', async () => {
    const listPage = vi
      .fn()
      .mockResolvedValue(eventsPage({ nextSyncToken: undefined }));

    await expect(
      fetchDelta(listPage, { syncToken: null, timeZone: 'UTC' }, NOW),
    ).rejects.toThrow('no sync token');
  });
});

describe('syncCalendar', () => {
  it('applies the delta, rotates the sync token and logs the trigger', async () => {
    const { services, google, repo, log } = createFakeServices();
    google.listEvents.mockResolvedValue(
      eventsPage({
        items: [STANDUP_MOVED, STANDUP_DELETED, OFFSITE],
        nextSyncToken: 'sync-2',
      }),
    );

    const outcome = await syncCalendar(services, calendarRow(), 'webhook');

    expect(outcome).toMatchObject({ ok: true, applied: true });
    expect(google.refreshAccessToken).toHaveBeenCalledWith('refresh-1');
    expect(google.listEvents).toHaveBeenCalledWith('access-1', 'me@gmail.com', {
      syncToken: 'sync-1',
      pageToken: undefined,
    });
    expect(repo.applySync).toHaveBeenCalledWith(
      CALENDAR_ID,
      expect.objectContaining({
        mode: 'incremental',
        nextSyncToken: 'sync-2',
        cancelled: ['standup'],
      }),
    );
    expect(repo.recordFailure).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      `[bell] sync calendar=${CALENDAR_ID} trigger=webhook mode=incremental upserts=1 cancelled=1`,
    );
  });

  it('skips a delta another sync overtook, without counting a failure, and retries from the newer token', async () => {
    const { services, google, repo, log } = createFakeServices();
    repo.applySync.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    repo.calendarById.mockResolvedValue(calendarRow({ sync_token: 'sync-7' }));
    google.listEvents.mockResolvedValue(
      eventsPage({ items: [STANDUP_MOVED], nextSyncToken: 'sync-8' }),
    );

    const outcome = await syncCalendar(services, calendarRow(), 'webhook');

    expect(outcome).toMatchObject({ ok: true, applied: true });
    expect(repo.calendarById).toHaveBeenCalledWith(CALENDAR_ID);
    expect(google.listEvents).toHaveBeenNthCalledWith(
      2,
      'access-1',
      'me@gmail.com',
      { syncToken: 'sync-7', pageToken: undefined },
    );
    expect(repo.applySync.mock.calls.map(([, d]) => d.fromSyncToken)).toEqual([
      'sync-1',
      'sync-7',
    ]);
    expect(repo.recordFailure).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      `[bell] sync-skipped calendar=${CALENDAR_ID} trigger=webhook reason=sync-token-changed attempt=1`,
    );
  });

  it('gives up after one retry, still without a failure', async () => {
    const { services, google, repo } = createFakeServices();
    repo.applySync.mockResolvedValue(false);

    const outcome = await syncCalendar(services, calendarRow(), 'webhook');

    expect(outcome).toMatchObject({ ok: true, applied: false });
    expect(google.listEvents).toHaveBeenCalledTimes(2);
    expect(repo.applySync).toHaveBeenCalledTimes(2);
    expect(repo.recordFailure).not.toHaveBeenCalled();
  });

  it('does not retry for a calendar dropped while the fetch ran', async () => {
    const { services, google, repo } = createFakeServices();
    repo.applySync.mockResolvedValue(false);
    repo.calendarById.mockResolvedValue(
      calendarRow({ active: false, sync_token: null }),
    );

    const outcome = await syncCalendar(services, calendarRow(), 'webhook');

    expect(outcome).toMatchObject({ ok: true, applied: false });
    expect(google.listEvents).toHaveBeenCalledTimes(1);
    expect(repo.recordFailure).not.toHaveBeenCalled();
  });

  it('records the failure instead of storing a token when Google fails', async () => {
    const { services, google, repo } = createFakeServices();
    google.listEvents.mockRejectedValue(
      new GoogleApiError(503, 'Google 503: Backend Error'),
    );

    const outcome = await syncCalendar(services, calendarRow(), 'webhook');

    expect(outcome).toEqual({ ok: false, error: 'Google 503: Backend Error' });
    expect(repo.applySync).not.toHaveBeenCalled();
    expect(repo.recordFailure).toHaveBeenCalledWith(
      CALENDAR_ID,
      'Google 503: Backend Error',
    );
  });

  it('records a revoked refresh token as a failure', async () => {
    const { services, google, repo } = createFakeServices();
    google.refreshAccessToken.mockRejectedValue(
      new GoogleApiError(400, 'Google 400: Token has been expired or revoked.'),
    );

    await syncCalendar(services, calendarRow(), 'webhook');

    expect(google.listEvents).not.toHaveBeenCalled();
    expect(repo.recordFailure).toHaveBeenCalledWith(
      CALENDAR_ID,
      'Google 400: Token has been expired or revoked.',
    );
  });

  it('stores a refresh token Google rotates', async () => {
    const { services, google, repo } = createFakeServices();
    google.refreshAccessToken.mockResolvedValue({
      access_token: 'access-2',
      refresh_token: 'refresh-2',
    } as never);

    await syncCalendar(services, calendarRow(), 'webhook');

    expect(repo.saveRefreshToken).toHaveBeenCalledWith(ACCOUNT_ID, 'refresh-2');
    expect(google.listEvents).toHaveBeenCalledWith(
      'access-2',
      'me@gmail.com',
      expect.anything(),
    );
  });
});
