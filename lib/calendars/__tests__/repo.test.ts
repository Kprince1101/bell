import { randomBytes } from 'node:crypto';
import type { AdminClient } from '@/lib/account';
import { createCalendarRepo } from '@/lib/calendars/repo';
import { decryptToken } from '@/lib/crypto/tokenCipher';
import {
  ACCOUNT_ID,
  CALENDAR_ID,
  accountRow,
  calendarRow,
} from '@/test-utils/calendarFakes';
import { USER_ID } from '@/test-utils/supabaseFake';

const KEY = randomBytes(32);

interface Result {
  data: unknown;
  error: unknown;
}

const createAdminRecorder = (results: Result[] = []) => {
  const calls: Array<[string, unknown[]]> = [];
  const next = (): Result => results.shift() ?? { data: null, error: null };
  const builder = {
    then: (resolve: (value: Result) => unknown) => resolve(next()),
  } as Record<string, unknown>;
  ['from', 'select', 'eq', 'order', 'or', 'upsert', 'update', 'delete'].forEach(
    (method) => {
      builder[method] = (...args: unknown[]) => {
        calls.push([method, args]);
        return builder;
      };
    },
  );
  ['single', 'maybeSingle'].forEach((method) => {
    builder[method] = async () => {
      calls.push([method, []]);
      return next();
    };
  });
  builder.rpc = async (...args: unknown[]) => {
    calls.push(['rpc', args]);
    return next();
  };
  const argsOf = (method: string) =>
    calls.filter(([name]) => name === method).map(([, args]) => args);
  return { admin: builder as unknown as AdminClient, calls, argsOf };
};

describe('createCalendarRepo', () => {
  it('stores the refresh token encrypted, never in the clear', async () => {
    const recorder = createAdminRecorder([{ data: accountRow(), error: null }]);
    const repo = createCalendarRepo(recorder.admin, () => KEY);

    await repo.saveAccount({
      userId: USER_ID,
      googleAccountId: 'google-sub-1',
      email: 'me@gmail.com',
      refreshToken: '1//plain-refresh',
    });

    const [secretRow, options] = recorder.argsOf('upsert')[1] as [
      { account_id: string; refresh_token_encrypted: string },
      unknown,
    ];
    expect(recorder.argsOf('from').flat()).toEqual([
      'accounts',
      'account_secrets',
    ]);
    expect(secretRow.account_id).toBe(ACCOUNT_ID);
    expect(secretRow.refresh_token_encrypted).not.toContain('plain-refresh');
    expect(decryptToken(secretRow.refresh_token_encrypted, KEY)).toBe(
      '1//plain-refresh',
    );
    expect(options).toEqual({ onConflict: 'account_id' });
  });

  it('decrypts the refresh token it reads back', async () => {
    const writer = createAdminRecorder([{ data: accountRow(), error: null }]);
    await createCalendarRepo(writer.admin, () => KEY).saveAccount({
      userId: USER_ID,
      googleAccountId: 'g',
      email: 'e',
      refreshToken: 'refresh-x',
    });
    const [secretRow] = writer.argsOf('upsert')[1] as [
      { refresh_token_encrypted: string },
    ];
    const reader = createAdminRecorder([{ data: secretRow, error: null }]);

    expect(
      await createCalendarRepo(reader.admin, () => KEY).refreshToken(
        ACCOUNT_ID,
      ),
    ).toBe('refresh-x');
  });

  it('adds discovered calendars without overwriting the user choices', async () => {
    const recorder = createAdminRecorder();
    const repo = createCalendarRepo(recorder.admin, () => KEY);

    await repo.saveDiscoveredCalendars(accountRow(), [
      { googleCalendarId: 'a', label: 'A', color: '#112233', timeZone: 'UTC' },
      { googleCalendarId: 'b', label: 'B', color: null, timeZone: null },
    ]);

    const [rows, options] = recorder.argsOf('upsert')[0];
    expect(rows).toEqual([
      {
        user_id: USER_ID,
        account_id: ACCOUNT_ID,
        google_calendar_id: 'a',
        label: 'A',
        time_zone: 'UTC',
        color: '#112233',
      },
      {
        user_id: USER_ID,
        account_id: ACCOUNT_ID,
        google_calendar_id: 'b',
        label: 'B',
        time_zone: null,
      },
    ]);
    expect(options).toEqual({
      onConflict: 'account_id,google_calendar_id',
      ignoreDuplicates: true,
      defaultToNull: false,
    });
  });

  it('finds active calendars with no channel or one expiring before the cutoff', async () => {
    const recorder = createAdminRecorder([
      { data: [calendarRow()], error: null },
    ]);
    const repo = createCalendarRepo(recorder.admin, () => KEY);

    await repo.calendarsDueForRenewal('2026-10-11T12:00:00.000Z');

    expect(recorder.argsOf('eq')).toEqual([['active', true]]);
    expect(recorder.argsOf('or')).toEqual([
      [
        'channel_expires_at.is.null,channel_expires_at.lt."2026-10-11T12:00:00.000Z"',
      ],
    ]);
  });

  it('heals push health when a channel is saved for a calendar without sync failures', async () => {
    const recorder = createAdminRecorder();
    const repo = createCalendarRepo(recorder.admin, () => KEY);
    const channel = {
      channelId: 'ch',
      resourceId: 'res',
      expiresAt: '2026-10-17T00:00:00.000Z',
    };

    await repo.saveChannel(
      calendarRow({ healthy: false, last_error: 'Push stopped' }),
      channel,
    );
    await repo.saveChannel(
      calendarRow({ fail_count: 3, healthy: false, last_error: 'Google 500' }),
      channel,
    );

    expect(recorder.argsOf('update')).toEqual([
      [
        {
          channel_id: 'ch',
          channel_resource_id: 'res',
          channel_expires_at: '2026-10-17T00:00:00.000Z',
          healthy: true,
          last_error: null,
        },
      ],
      [
        {
          channel_id: 'ch',
          channel_resource_id: 'res',
          channel_expires_at: '2026-10-17T00:00:00.000Z',
          healthy: false,
          last_error: 'Google 500',
        },
      ],
    ]);
  });

  it('applies a sync through the single shared upsert function', async () => {
    const recorder = createAdminRecorder();
    const repo = createCalendarRepo(recorder.admin, () => KEY);

    await repo.applySync(CALENDAR_ID, {
      mode: 'full',
      upserts: [],
      cancelled: ['x'],
      nextSyncToken: 'next',
      windowStart: 'w',
      seenAt: 's',
    });

    expect(recorder.argsOf('rpc')).toEqual([
      [
        'apply_sync',
        {
          p_calendar_id: CALENDAR_ID,
          p_events: [],
          p_cancelled: ['x'],
          p_sync_token: 'next',
          p_full: true,
          p_window_start: 'w',
          p_seen_at: 's',
        },
      ],
    ]);
  });

  it('clears sync state and events of a dropped calendar', async () => {
    const recorder = createAdminRecorder();
    const repo = createCalendarRepo(recorder.admin, () => KEY);

    await repo.clearCalendar(CALENDAR_ID);

    expect(recorder.argsOf('update')[0][0]).toMatchObject({
      sync_token: null,
      channel_id: null,
    });
    expect(recorder.argsOf('from').flat()).toEqual(['calendars', 'events']);
    expect(recorder.argsOf('eq')).toEqual([
      ['id', CALENDAR_ID],
      ['calendar_id', CALENDAR_ID],
    ]);
  });

  it('throws database errors', async () => {
    const recorder = createAdminRecorder([
      { data: null, error: new Error('permission denied') },
    ]);
    const repo = createCalendarRepo(recorder.admin, () => KEY);

    await expect(repo.markPushStopped('now')).rejects.toThrow(
      'permission denied',
    );
  });
});
