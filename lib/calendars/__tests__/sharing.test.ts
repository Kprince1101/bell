import {
  buildSharingView,
  createShareRepo,
  loadSharingView,
  removeShare,
  shareCalendar,
} from '@/lib/calendars/sharing';
import type { ShareRepo } from '@/lib/calendars/sharing';
import { SHARE_ERRORS } from '@/lib/constants';
import { ApiError } from '@/lib/errors';
import type { BellClient } from '@/lib/supabase/server';
import { createPgliteAdmin } from '@/supabase/testing/pgliteAdmin';
import { createShareDb } from '@/supabase/testing/shareSeed';

const CAL = '55555555-5555-5555-5555-555555555555';
const OTHER_CAL = '66666666-6666-6666-6666-666666666666';
const OWNER = '11111111-1111-1111-1111-111111111111';
const TEAMMATE = '33333333-3333-3333-3333-333333333333';

const fakeRepo = (
  outcome: Awaited<ReturnType<ShareRepo['share']>>,
  removed = true,
): ShareRepo => ({
  share: vi.fn(async () => outcome),
  unshare: vi.fn(async () => removed),
});

const rejection = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (err) {
    if (err instanceof ApiError)
      return { status: err.status, message: err.message };
  }
  return null;
};

describe('shareCalendar', () => {
  it('passes a successful share through', async () => {
    const repo = fakeRepo('shared');

    await shareCalendar(repo, OWNER, CAL, 'teammate@example.com');

    expect(repo.share).toHaveBeenCalledWith(OWNER, CAL, 'teammate@example.com');
  });

  it.each(['unknown_calendar', 'unknown_user', 'self'] as const)(
    'turns %s into a readable API error',
    async (outcome) => {
      expect(
        await rejection(
          shareCalendar(fakeRepo(outcome), OWNER, CAL, 'x@example.com'),
        ),
      ).toEqual({
        status: SHARE_ERRORS[outcome].status,
        message: SHARE_ERRORS[outcome].message,
      });
    },
  );
});

describe('removeShare', () => {
  it('says so when the share is already gone', async () => {
    expect(
      await rejection(
        removeShare(fakeRepo('shared', false), OWNER, CAL, TEAMMATE),
      ),
    ).toEqual({ status: 404, message: SHARE_ERRORS.missing.message });
  });
});

describe('createShareRepo', () => {
  it('shares and unshares through the service-only functions', async () => {
    const { db, owner, teammate } = await createShareDb();
    const repo = createShareRepo(createPgliteAdmin(db));

    expect(
      await repo.share(owner.id, owner.teamCalendarId, teammate.email),
    ).toBe('shared');
    expect(
      await repo.share(owner.id, owner.teamCalendarId, 'ghost@example.com'),
    ).toBe('unknown_user');
    expect(
      await repo.unshare(owner.id, owner.teamCalendarId, teammate.id),
    ).toBe(true);
    expect(
      await repo.unshare(owner.id, owner.teamCalendarId, teammate.id),
    ).toBe(false);
    await db.close();
  });
});

describe('buildSharingView', () => {
  it('groups recipients under each owned calendar and lists what is shared with me', () => {
    const view = buildSharingView(
      OWNER,
      [
        { id: CAL, label: 'Team', color: '#0b8043' },
        { id: OTHER_CAL, label: 'Private', color: '#0b8043' },
      ],
      [
        {
          calendar_id: CAL,
          shared_with_user_id: TEAMMATE,
          email: 'teammate@example.com',
        },
      ],
      [{ id: OTHER_CAL, label: 'Their team', color: '#0b8043' }],
    );

    expect(view).toEqual({
      userId: OWNER,
      owned: [
        {
          calendarId: CAL,
          label: 'Team',
          color: '#0b8043',
          recipients: [{ userId: TEAMMATE, email: 'teammate@example.com' }],
        },
        {
          calendarId: OTHER_CAL,
          label: 'Private',
          color: '#0b8043',
          recipients: [],
        },
      ],
      sharedWithMe: [
        { calendarId: OTHER_CAL, label: 'Their team', color: '#0b8043' },
      ],
    });
  });
});

describe('loadSharingView', () => {
  it('reads the user’s included calendars and both share lists', async () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(async () => ({
        data: [{ id: CAL, label: 'Team', color: '#0b8043' }],
        error: null,
      })),
    };
    const rpc = vi.fn(async (fn: string) => {
      if (fn === 'my_shares') {
        return {
          data: [
            {
              calendar_id: CAL,
              shared_with_user_id: TEAMMATE,
              email: 'teammate@example.com',
            },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    });
    const client = { from: vi.fn(() => query), rpc } as unknown as BellClient;

    const view = await loadSharingView(client, OWNER);

    expect(query.eq).toHaveBeenCalledWith('user_id', OWNER);
    expect(query.eq).toHaveBeenCalledWith('active', true);
    expect(rpc).toHaveBeenCalledWith('shared_with_me');
    expect(view.owned[0].recipients).toEqual([
      { userId: TEAMMATE, email: 'teammate@example.com' },
    ]);
    expect(view.sharedWithMe).toEqual([]);
  });
});
