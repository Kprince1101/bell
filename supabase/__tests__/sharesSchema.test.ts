import type { PGlite } from '@electric-sql/pglite';
import { plusMinutes, thisMinute } from '@/supabase/testing/notifySeed';
import {
  actAs,
  actAsOwner,
  bellTables,
  countMentions,
} from '@/supabase/testing/pglite';
import {
  addMeeting,
  createShareDb,
  shareWith,
  stepsFor,
  unshare,
} from '@/supabase/testing/shareSeed';
import type { SeededPerson } from '@/supabase/testing/shareSeed';

const EVERY_BELL_TABLE = [
  'account_secrets',
  'accounts',
  'agenda_visits',
  'allowlist',
  'calendar_shares',
  'calendars',
  'channel_secrets',
  'channel_tests',
  'channels',
  'events',
  'job_runs',
  'migrations',
  'notifications',
  'slack_installs',
  'stale_receipts',
  'users',
];

const TABLES_WITHOUT_USER_ROWS = ['job_runs', 'migrations'];

const READABLE_OWN_TABLES = [
  'users',
  'accounts',
  'calendars',
  'events',
  'agenda_visits',
  'channels',
  'notifications',
  'calendar_shares',
];

const FULL_FLOW = [
  '30m:slack:pending',
  '30m:pushover:pending',
  '10m:slack:pending',
  '10m:pushover:pending',
  '2m:pushover:pending',
  '2m:sms:pending',
  'start:voice:pending',
];

const markersOf = (who: SeededPerson): string[] => [
  who.id,
  who.email,
  who.accountId,
  who.teamCalendarId,
  who.privateCalendarId,
];

const accountSecretsOf = (who: SeededPerson): string[] => [
  who.accountId,
  `google-${who.email}`,
  `v1.refresh-${who.email}`,
  `sync-${who.email}`,
  `resource-${who.email}`,
];

const visibleMentions = async (
  db: PGlite,
  viewer: SeededPerson,
  table: string,
  markers: string[],
): Promise<number | 'denied'> => {
  await actAs(db, viewer.id);
  try {
    return await countMentions(db, table, markers);
  } catch {
    return 'denied';
  } finally {
    await actAsOwner(db);
  }
};

const tryDeleteAll = async (
  db: PGlite,
  viewer: SeededPerson,
  table: string,
) => {
  await actAs(db, viewer.id);
  try {
    await db.query(`delete from bell.${table}`);
  } catch {
    return;
  } finally {
    await actAsOwner(db);
  }
};

const asUser = async <Row>(
  db: PGlite,
  viewer: SeededPerson,
  sql: string,
  params: unknown[] = [],
): Promise<Row[]> => {
  await actAs(db, viewer.id);
  try {
    return (await db.query<Row>(sql, params)).rows;
  } finally {
    await actAsOwner(db);
  }
};

interface Delivery {
  user_id: string;
  step: string;
  channel: string;
  target: string;
  time_zone: string;
  slack_ref: string | null;
  id: string;
}

const claim = async (db: PGlite, at: Date): Promise<Delivery[]> =>
  (
    await db.query<{ claim_due_notifications: Delivery }>(
      'select * from bell.claim_due_notifications($1)',
      [at.toISOString()],
    )
  ).rows.map((row) => row.claim_due_notifications);

const deleteMe = async (db: PGlite, who: SeededPerson): Promise<boolean> => {
  const [row] = await asUser<{ remove_auth_user: boolean }>(
    db,
    who,
    'select bell.delete_me() as remove_auth_user',
  );
  return row.remove_auth_user;
};

const describeDelivery = (row: Delivery) =>
  `${row.user_id}:${row.step}:${row.channel}`;

describe('0006 order', () => {
  it('applies after every earlier migration on its base, and last', async () => {
    const { db } = await createShareDb();

    const { rows } = await db.query<{ name: string }>(
      'select name from bell.migrations order by applied_at, name',
    );
    const names = rows.map((row) => row.name);

    expect(names).toEqual([...names].sort());
    expect(names.slice(0, 4)).toEqual([
      '0001_bell.sql',
      '0002_google_calendars.sql',
      '0003_agenda.sql',
      '0004_notifications.sql',
    ]);
    expect(names.at(-1)).toBe('0006_calendar_shares.sql');
    await db.close();
  });
});

describe('0006 two-user isolation across every bell table', () => {
  it('no signed-in user can read or delete another user’s rows in any bell.* table', async () => {
    const { db, owner, teammate, outsider } = await createShareDb();
    const base = thisMinute();
    for (const who of [owner, teammate]) {
      await shareWith(db, who, who.teamCalendarId, outsider.email);
      await addMeeting(db, who, who.teamCalendarId, plusMinutes(base, 30));
      await addMeeting(db, who, who.privateCalendarId, plusMinutes(base, 30));
      await db.query(
        'insert into bell.stale_receipts (receipt, user_id, event_id) values ($1, $2, gen_random_uuid())',
        [`receipt-${who.email}`, who.id],
      );
    }

    expect(await bellTables(db)).toEqual(EVERY_BELL_TABLE);
    for (const [viewer, other] of [
      [owner, teammate],
      [teammate, owner],
    ]) {
      const markers = markersOf(other);
      for (const table of EVERY_BELL_TABLE) {
        const before = await countMentions(db, table, markers);
        if (!TABLES_WITHOUT_USER_ROWS.includes(table)) {
          expect({ table, seeded: before > 0 }).toEqual({
            table,
            seeded: true,
          });
        }

        const seen = await visibleMentions(db, viewer, table, markers);
        await tryDeleteAll(db, viewer, table);

        expect({ table, seen: seen === 'denied' || seen === 0 }).toEqual({
          table,
          seen: true,
        });
        expect({
          table,
          after: await countMentions(db, table, markers),
        }).toEqual({ table, after: before });
      }
      for (const table of READABLE_OWN_TABLES) {
        expect({
          table,
          own: await visibleMentions(db, viewer, table, [viewer.id]),
        }).not.toEqual({ table, own: 0 });
      }
    }
    await db.close();
  });

  it('a signed-in user can neither write a share nor call the service-only share functions', async () => {
    const { db, owner, teammate } = await createShareDb();
    await actAs(db, owner.id);

    await expect(
      db.query(
        'insert into bell.calendar_shares (calendar_id, shared_with_user_id, created_by) values ($1, $2, $3)',
        [owner.teamCalendarId, teammate.id, owner.id],
      ),
    ).rejects.toThrow();
    await expect(
      db.query('select bell.share_calendar($1, $2, $3)', [
        owner.id,
        owner.teamCalendarId,
        teammate.email,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query('select bell.unshare_calendar($1, $2, $3)', [
        owner.id,
        owner.teamCalendarId,
        teammate.id,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query('select * from bell.calendar_recipients($1)', [
        owner.teamCalendarId,
      ]),
    ).rejects.toThrow();
    await actAsOwner(db);
    await db.close();
  });
});

describe('0006 sharing a calendar', () => {
  it('shows the teammate only the shared calendar’s events, never the sharer’s account, token or other calendars', async () => {
    const { db, owner, teammate } = await createShareDb();
    const shared = await addMeeting(
      db,
      owner,
      owner.teamCalendarId,
      plusMinutes(thisMinute(), 120),
      'Team planning',
    );
    await addMeeting(
      db,
      owner,
      owner.privateCalendarId,
      plusMinutes(thisMinute(), 120),
      'Dentist',
    );

    expect(
      await shareWith(
        db,
        owner,
        owner.teamCalendarId,
        ' TEAMMATE@example.com ',
      ),
    ).toBe('shared');

    const events = await asUser<{ id: string; title: string }>(
      db,
      teammate,
      'select id, title from bell.events where user_id = $1',
      [owner.id],
    );
    const calendars = await asUser(
      db,
      teammate,
      'select id from bell.calendars where user_id = $1',
      [owner.id],
    );
    const sharedWithMe = await asUser(
      db,
      teammate,
      'select * from bell.shared_with_me()',
    );
    const myShares = await asUser(db, owner, 'select * from bell.my_shares()');
    const ownerSeesTeammate = await asUser(
      db,
      owner,
      'select id from bell.events where user_id = $1',
      [teammate.id],
    );

    expect(events).toEqual([{ id: shared, title: 'Team planning' }]);
    expect(calendars).toEqual([]);
    expect(sharedWithMe).toEqual([
      { id: owner.teamCalendarId, label: 'Team', color: '#0b8043' },
    ]);
    expect(myShares).toEqual([
      {
        calendar_id: owner.teamCalendarId,
        shared_with_user_id: teammate.id,
        email: teammate.email,
      },
    ]);
    expect(ownerSeesTeammate).toEqual([]);
    for (const table of EVERY_BELL_TABLE) {
      const leaked = await visibleMentions(
        db,
        teammate,
        table,
        accountSecretsOf(owner),
      );
      expect({ table, leaked: leaked === 'denied' || leaked === 0 }).toEqual({
        table,
        leaked: true,
      });
    }
    await db.close();
  });

  it('refuses a calendar the sharer does not own, an email nobody uses, and the sharer’s own email', async () => {
    const { db, owner, teammate, outsider } = await createShareDb();

    expect(
      await shareWith(db, teammate, owner.teamCalendarId, outsider.email),
    ).toBe('unknown_calendar');
    expect(
      await shareWith(db, owner, owner.teamCalendarId, 'ghost@example.com'),
    ).toBe('unknown_user');
    expect(await shareWith(db, owner, owner.teamCalendarId, owner.email)).toBe(
      'self',
    );
    expect(
      await shareWith(db, owner, owner.teamCalendarId, teammate.email),
    ).toBe('shared');
    expect(
      await shareWith(db, owner, owner.teamCalendarId, teammate.email),
    ).toBe('shared');

    const { rows } = await db.query('select * from bell.calendar_shares');
    expect(rows).toHaveLength(1);
    await db.close();
  });

  it('rings the teammate on their own channels and time zone, and each person acknowledges separately', async () => {
    const { db, owner, teammate } = await createShareDb();
    const base = thisMinute();
    await shareWith(db, owner, owner.teamCalendarId, teammate.email);

    const eventId = await addMeeting(
      db,
      owner,
      owner.teamCalendarId,
      plusMinutes(base, 30),
    );

    expect(await stepsFor(db, eventId, owner.id)).toEqual(FULL_FLOW);
    expect(await stepsFor(db, eventId, teammate.id)).toEqual(FULL_FLOW);

    const first = await claim(db, base);
    expect(first.map(describeDelivery)).toEqual([
      `${owner.id}:30m:slack`,
      `${owner.id}:30m:pushover`,
      `${teammate.id}:30m:slack`,
      `${teammate.id}:30m:pushover`,
    ]);
    const teammateSlack = first.find(
      (row) => row.user_id === teammate.id && row.channel === 'slack',
    );
    expect(teammateSlack?.target).toBe(teammate.slackUser);
    expect(teammateSlack?.time_zone).toBe(teammate.timeZone);
    for (const row of first.filter(
      (delivery) => delivery.channel === 'slack',
    )) {
      await db.query(
        "select bell.finish_notification($1, 'sent', null, $2, $3)",
        [row.id, `ref-${row.user_id}`, base.toISOString()],
      );
    }

    await db.query('select * from bell.acknowledge_event($1, $2, $3, $4)', [
      eventId,
      owner.id,
      'app:owner@example.com',
      plusMinutes(base, 1).toISOString(),
    ]);
    const second = await claim(db, plusMinutes(base, 20));

    expect(second.map(describeDelivery)).toEqual([
      `${teammate.id}:10m:slack`,
      `${teammate.id}:10m:pushover`,
    ]);
    expect(second[0].slack_ref).toBe(`ref-${teammate.id}`);
    await db.close();
  });

  it('a quiet calendar silences only its owner, never the teammate it is shared with', async () => {
    const { db, owner, teammate } = await createShareDb();
    await shareWith(db, owner, owner.teamCalendarId, teammate.email);
    await db.query('select bell.set_calendar_quiet($1, $2, true)', [
      owner.id,
      owner.teamCalendarId,
    ]);

    const eventId = await addMeeting(
      db,
      owner,
      owner.teamCalendarId,
      plusMinutes(thisMinute(), 30),
    );

    expect(await stepsFor(db, eventId, owner.id)).toEqual([]);
    expect(await stepsFor(db, eventId, teammate.id)).toEqual(FULL_FLOW);
    await db.close();
  });

  it('a moved meeting sends the teammate their own moved push', async () => {
    const { db, owner, teammate } = await createShareDb();
    const base = thisMinute();
    await shareWith(db, owner, owner.teamCalendarId, teammate.email);
    const eventId = await addMeeting(
      db,
      owner,
      owner.teamCalendarId,
      plusMinutes(base, 30),
    );

    await db.query('update bell.events set starts_at = $2 where id = $1', [
      eventId,
      plusMinutes(base, 90).toISOString(),
    ]);

    expect(await stepsFor(db, eventId, owner.id)).toEqual([
      'moved:pushover:pending',
    ]);
    expect(await stepsFor(db, eventId, teammate.id)).toEqual([
      'moved:pushover:pending',
    ]);
    await db.close();
  });

  it('a Slack acknowledge from the teammate is credited to the teammate, and a stranger’s is ignored', async () => {
    const { db, owner, teammate, outsider } = await createShareDb();
    await shareWith(db, owner, owner.teamCalendarId, teammate.email);
    const eventId = await addMeeting(
      db,
      owner,
      owner.teamCalendarId,
      plusMinutes(thisMinute(), 30),
    );
    const ownerOf = async (who: SeededPerson) =>
      (
        await db.query<{ slack_event_owner: string | null }>(
          'select bell.slack_event_owner($1, $2, $3)',
          [eventId, who.slackTeam, who.slackUser],
        )
      ).rows[0].slack_event_owner;

    expect(await ownerOf(owner)).toBe(owner.id);
    expect(await ownerOf(teammate)).toBe(teammate.id);
    expect(await ownerOf(outsider)).toBeNull();
    await db.close();
  });
});

describe('0006 removing a share', () => {
  it('drops the events from the teammate’s agenda and cancels only their pending notifications', async () => {
    const { db, owner, teammate } = await createShareDb();
    const base = thisMinute();
    await shareWith(db, owner, owner.teamCalendarId, teammate.email);
    const eventId = await addMeeting(
      db,
      owner,
      owner.teamCalendarId,
      plusMinutes(base, 30),
    );
    await claim(db, base);

    expect(await unshare(db, owner, owner.teamCalendarId, teammate)).toBe(true);

    const events = await asUser(
      db,
      teammate,
      'select id from bell.events where user_id = $1',
      [owner.id],
    );
    const sharedWithMe = await asUser(
      db,
      teammate,
      'select * from bell.shared_with_me()',
    );
    expect(events).toEqual([]);
    expect(sharedWithMe).toEqual([]);
    expect((await stepsFor(db, eventId, teammate.id)).slice(2)).toEqual([
      '10m:slack:cancelled',
      '10m:pushover:cancelled',
      '2m:pushover:cancelled',
      '2m:sms:cancelled',
      'start:voice:cancelled',
    ]);
    expect((await stepsFor(db, eventId, owner.id)).slice(2)).toEqual(
      FULL_FLOW.slice(2),
    );

    await db.query('select bell.materialize_notifications($1)', [
      plusMinutes(base, 1).toISOString(),
    ]);
    const later = await claim(db, plusMinutes(base, 20));
    expect(later.map(describeDelivery)).toEqual([
      `${owner.id}:10m:slack`,
      `${owner.id}:10m:pushover`,
    ]);
    expect(await stepsFor(db, eventId, teammate.id)).toHaveLength(7);
    await db.close();
  });

  it('lets the teammate remove a share themselves, but not a stranger', async () => {
    const { db, owner, teammate, outsider } = await createShareDb();
    await shareWith(db, owner, owner.teamCalendarId, teammate.email);

    expect(await unshare(db, outsider, owner.teamCalendarId, teammate)).toBe(
      false,
    );
    expect(await unshare(db, teammate, owner.teamCalendarId, teammate)).toBe(
      true,
    );
    expect(await unshare(db, teammate, owner.teamCalendarId, teammate)).toBe(
      false,
    );
    await db.close();
  });

  it('sharing again brings the teammate’s notifications back', async () => {
    const { db, owner, teammate } = await createShareDb();
    const base = thisMinute();
    await shareWith(db, owner, owner.teamCalendarId, teammate.email);
    const eventId = await addMeeting(
      db,
      owner,
      owner.teamCalendarId,
      plusMinutes(base, 30),
    );
    await unshare(db, owner, owner.teamCalendarId, teammate);

    await shareWith(db, owner, owner.teamCalendarId, teammate.email);
    await db.query('select bell.materialize_notifications($1)', [
      base.toISOString(),
    ]);

    expect(await stepsFor(db, eventId, teammate.id)).toEqual(FULL_FLOW);
    await db.close();
  });
});

describe('0006 delete_me with shares', () => {
  it('when the sharer deletes their account the teammate loses the shared events and every pending notification for them', async () => {
    const { db, owner, teammate } = await createShareDb();
    await shareWith(db, owner, owner.teamCalendarId, teammate.email);
    const eventId = await addMeeting(
      db,
      owner,
      owner.teamCalendarId,
      plusMinutes(thisMinute(), 30),
    );
    expect(await stepsFor(db, eventId, teammate.id)).toEqual(FULL_FLOW);

    const removeAuthUser = await deleteMe(db, owner);
    await db.query('delete from auth.users where id = $1', [owner.id]);

    expect(removeAuthUser).toBe(true);
    const events = await asUser(db, teammate, 'select id from bell.events');
    const sharedWithMe = await asUser(
      db,
      teammate,
      'select * from bell.shared_with_me()',
    );
    let ownerRows = 0;
    for (const table of EVERY_BELL_TABLE) {
      ownerRows += await countMentions(db, table, markersOf(owner));
    }
    expect(events).toEqual([]);
    expect(sharedWithMe).toEqual([]);
    expect(await stepsFor(db, eventId, teammate.id)).toEqual([]);
    expect(ownerRows).toBe(0);
    expect(await countMentions(db, 'calendars', [teammate.id])).toBeGreaterThan(
      0,
    );
    await db.close();
  });

  it('when the teammate deletes their account the share goes and the sharer keeps everything else', async () => {
    const { db, owner, teammate } = await createShareDb();
    await shareWith(db, owner, owner.teamCalendarId, teammate.email);
    await addMeeting(
      db,
      owner,
      owner.teamCalendarId,
      plusMinutes(thisMinute(), 30),
    );

    expect(await deleteMe(db, teammate)).toBe(true);

    const shares = await db.query('select * from bell.calendar_shares');
    const myShares = await asUser(db, owner, 'select * from bell.my_shares()');
    expect(shares.rows).toEqual([]);
    expect(myShares).toEqual([]);
    expect(await countMentions(db, 'events', [owner.id])).toBe(1);
    expect(await countMentions(db, 'notifications', [teammate.id])).toBe(0);
    await db.close();
  });

  it('a sharer with a Commander profile keeps their login, but their shares and the teammate’s notifications still go', async () => {
    const { db, owner, teammate } = await createShareDb();
    await db.exec(
      'create table public.profiles (user_id uuid primary key references auth.users(id))',
    );
    await db.query('insert into public.profiles (user_id) values ($1)', [
      owner.id,
    ]);
    await shareWith(db, owner, owner.teamCalendarId, teammate.email);
    const eventId = await addMeeting(
      db,
      owner,
      owner.teamCalendarId,
      plusMinutes(thisMinute(), 30),
    );

    expect(await deleteMe(db, owner)).toBe(false);

    const shares = await db.query('select * from bell.calendar_shares');
    const authUser = await db.query('select id from auth.users where id = $1', [
      owner.id,
    ]);
    expect(shares.rows).toEqual([]);
    expect(await stepsFor(db, eventId, teammate.id)).toEqual([]);
    expect(authUser.rows).toEqual([{ id: owner.id }]);
    for (const table of EVERY_BELL_TABLE) {
      expect({
        table,
        left: await countMentions(db, table, markersOf(owner)),
      }).toEqual({ table, left: 0 });
    }
    await db.close();
  });
});
