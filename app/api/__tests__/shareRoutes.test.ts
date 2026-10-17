import type { PGlite } from '@electric-sql/pglite';
import { DELETE, POST } from '@/app/api/calendars/shares/route';
import { SHARE_ERRORS } from '@/lib/constants';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { createPgliteAdmin } from '@/supabase/testing/pgliteAdmin';
import { createShareDb } from '@/supabase/testing/shareSeed';
import type { ShareDb } from '@/supabase/testing/shareSeed';
import { createSupabaseFake } from '@/test-utils/supabaseFake';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));

const userFor = (userId: string | null) => {
  if (!userId) return null;
  return { id: userId };
};

const signIn = (db: PGlite, userId: string | null) => {
  vi.mocked(createClient).mockResolvedValue(
    createSupabaseFake({ user: userFor(userId) }).client,
  );
  vi.mocked(createAdminClient).mockReturnValue(
    createPgliteAdmin(db) as unknown as ReturnType<typeof createAdminClient>,
  );
};

const json = (method: string, body: unknown) =>
  new Request('https://bell.test/api/calendars/shares', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const shareCount = async (db: PGlite) =>
  (
    await db.query<{ n: number }>(
      'select count(*)::int as n from bell.calendar_shares',
    )
  ).rows[0].n;

describe('/api/calendars/shares', () => {
  let seeded: ShareDb;

  beforeEach(async () => {
    seeded = await createShareDb();
  });

  afterEach(async () => {
    await seeded.db.close();
  });

  it('refuses a signed-out visitor', async () => {
    signIn(seeded.db, null);

    const response = await POST(
      json('POST', {
        calendarId: seeded.owner.teamCalendarId,
        email: seeded.teammate.email,
      }),
    );

    expect(response.status).toBe(401);
    expect(await shareCount(seeded.db)).toBe(0);
  });

  it('shares the signed-in user’s calendar with a teammate by email, then stops', async () => {
    const { db, owner, teammate } = seeded;
    signIn(db, owner.id);

    const shared = await POST(
      json('POST', {
        calendarId: owner.teamCalendarId,
        email: 'Teammate@Example.com',
      }),
    );
    expect(shared.status).toBe(200);
    expect(await shareCount(db)).toBe(1);

    const removed = await DELETE(
      json('DELETE', {
        calendarId: owner.teamCalendarId,
        sharedWithUserId: teammate.id,
      }),
    );
    expect(removed.status).toBe(200);
    expect(await shareCount(db)).toBe(0);

    const again = await DELETE(
      json('DELETE', {
        calendarId: owner.teamCalendarId,
        sharedWithUserId: teammate.id,
      }),
    );
    expect(again.status).toBe(404);
    expect(await again.json()).toEqual({ error: SHARE_ERRORS.missing.message });
  });

  it('explains why a share was refused', async () => {
    const { db, owner, teammate } = seeded;
    signIn(db, owner.id);

    const nobody = await POST(
      json('POST', {
        calendarId: owner.teamCalendarId,
        email: 'ghost@example.com',
      }),
    );
    const notMine = await POST(
      json('POST', {
        calendarId: teammate.teamCalendarId,
        email: 'outsider@example.com',
      }),
    );
    const notAnEmail = await POST(
      json('POST', { calendarId: owner.teamCalendarId, email: 'nope' }),
    );

    expect(nobody.status).toBe(404);
    expect(await nobody.json()).toEqual({
      error: SHARE_ERRORS.unknown_user.message,
    });
    expect(notMine.status).toBe(404);
    expect(notAnEmail.status).toBe(400);
    expect(await notAnEmail.json()).toEqual({
      error: 'Enter your teammate’s email address.',
    });
    expect(await shareCount(db)).toBe(0);
  });

  it('lets the teammate drop a calendar shared with them', async () => {
    const { db, owner, teammate } = seeded;
    signIn(db, owner.id);
    await POST(
      json('POST', {
        calendarId: owner.teamCalendarId,
        email: teammate.email,
      }),
    );
    signIn(db, teammate.id);

    const removed = await DELETE(
      json('DELETE', {
        calendarId: owner.teamCalendarId,
        sharedWithUserId: teammate.id,
      }),
    );

    expect(removed.status).toBe(200);
    expect(await shareCount(db)).toBe(0);
  });
});
