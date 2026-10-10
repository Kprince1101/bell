import { GoogleApiError } from '@/lib/google/errors';
import { fetchDelta, syncWindow } from '@/lib/sync/delta';
import { syncCalendar } from '@/lib/sync/syncCalendar';
import {
  ACCOUNT_ID,
  CALENDAR_ID,
  NOW,
  calendarRow,
  createFakeServices,
  eventsPage,
} from '@/test-utils/calendarFakes';
import {
  OFFSITE,
  STANDUP,
  STANDUP_DELETED,
  STANDUP_MOVED,
  WEEKLY_SERIES_DELETED,
} from '@/test-utils/googleFixtures';

const WINDOW = {
  timeMin: '2026-10-03T12:00:00.000Z',
  timeMax: '2026-12-09T12:00:00.000Z',
};

describe('syncWindow', () => {
  it('spans 7 days back and 60 days ahead', () => {
    expect(syncWindow(NOW)).toEqual(WINDOW);
  });
});

describe('fetchDelta', () => {
  it('does a bounded full sync across pages when there is no sync token', async () => {
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
      nextSyncToken: 'sync-9',
      windowStart: WINDOW.timeMin,
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

    expect(outcome.ok).toBe(true);
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
