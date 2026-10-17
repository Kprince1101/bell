import type { PGlite } from '@electric-sql/pglite';
import { actAs, actAsOwner } from '@/supabase/testing/pglite';
import {
  ME,
  NEIGHBOUR,
  PHONE,
  addEvent,
  connectEveryChannel,
  createNotifyDb,
  notificationsFor,
  plusMinutes,
  saveChannel,
  stepsOf,
  thisMinute,
} from '@/supabase/testing/notifySeed';

const claim = async (db: PGlite, at: Date) =>
  (
    await db.query<{
      claim_due_notifications: { step: string; channel: string };
    }>('select * from bell.claim_due_notifications($1)', [at.toISOString()])
  ).rows.map(
    ({ claim_due_notifications: row }) => `${row.step}:${row.channel}`,
  );

const materialize = (db: PGlite, at: Date) =>
  db.query('select bell.materialize_notifications($1)', [at.toISOString()]);

const ready = async () => {
  const seeded = await createNotifyDb();
  await connectEveryChannel(seeded.db, ME);
  return { ...seeded, base: thisMinute() };
};

describe('0004 materialization windows', () => {
  it('lays out every escalation step on the channels the user has on', async () => {
    const { db, calendarId, base } = await ready();
    await db.query("select bell.set_channel_active($1, 'voice', false)", [ME]);

    const eventId = await addEvent(db, calendarId, {
      startsAt: plusMinutes(base, 30),
    });

    const rows = await notificationsFor(db, eventId);
    expect(stepsOf(rows)).toEqual([
      '30m:slack:pending',
      '30m:pushover:pending',
      '10m:slack:pending',
      '10m:pushover:pending',
      '2m:pushover:pending',
      '2m:sms:pending',
    ]);
    expect(rows[0].due_at.toISOString()).toBe(base.toISOString());
    expect(rows[5].due_at.toISOString()).toBe(
      plusMinutes(base, 28).toISOString(),
    );
    await db.close();
  });

  it('waits until an event is 35 minutes out and never doubles a step', async () => {
    const { db, calendarId, base } = await ready();
    const eventId = await addEvent(db, calendarId, {
      startsAt: plusMinutes(base, 50),
    });

    expect(await notificationsFor(db, eventId)).toEqual([]);
    await materialize(db, plusMinutes(base, 14));
    expect(await notificationsFor(db, eventId)).toEqual([]);
    await materialize(db, plusMinutes(base, 16));
    await materialize(db, plusMinutes(base, 17));

    expect(stepsOf(await notificationsFor(db, eventId))).toHaveLength(7);
    await db.close();
  });

  it('sends nothing for all-day, cancelled or quiet-calendar events', async () => {
    const { db, calendarId, base } = await ready();
    const allDay = await addEvent(db, calendarId, {
      startsAt: plusMinutes(base, 20),
      allDay: true,
    });
    const cancelled = await addEvent(db, calendarId, {
      startsAt: plusMinutes(base, 20),
      status: 'cancelled',
    });
    await db.query('select bell.set_calendar_quiet($1, $2, true)', [
      ME,
      calendarId,
    ]);
    const quiet = await addEvent(db, calendarId, {
      startsAt: plusMinutes(base, 20),
    });

    await materialize(db, base);

    for (const eventId of [allDay, cancelled, quiet]) {
      expect(await notificationsFor(db, eventId)).toEqual([]);
    }
    await db.close();
  });

  it('a calendar made quiet after materializing cancels at send time', async () => {
    const { db, calendarId, base } = await ready();
    const eventId = await addEvent(db, calendarId, {
      startsAt: plusMinutes(base, 30),
    });
    await db.query('select bell.set_calendar_quiet($1, $2, true)', [
      ME,
      calendarId,
    ]);

    expect(await claim(db, base)).toEqual([]);
    expect(stepsOf(await notificationsFor(db, eventId)).slice(0, 2)).toEqual([
      '30m:slack:cancelled',
      '30m:pushover:cancelled',
    ]);
    await db.close();
  });
});

describe('0004 claiming', () => {
  it('hands each due step out once, even to two ticks in the same minute', async () => {
    const { db, calendarId, base } = await ready();
    await addEvent(db, calendarId, { startsAt: plusMinutes(base, 30) });

    expect(await claim(db, base)).toEqual(['30m:slack', '30m:pushover']);
    expect(await claim(db, base)).toEqual([]);
    expect(await claim(db, plusMinutes(base, 20))).toEqual([
      '10m:slack',
      '10m:pushover',
    ]);
    expect(await claim(db, plusMinutes(base, 20))).toEqual([]);
    await db.close();
  });

  it('after an outage sends only the latest due step and skips the stale ones', async () => {
    const { db, calendarId, base } = await ready();
    const eventId = await addEvent(db, calendarId, {
      startsAt: plusMinutes(base, 30),
    });

    expect(await claim(db, plusMinutes(base, 21))).toEqual([
      '10m:slack',
      '10m:pushover',
    ]);
    const rows = await notificationsFor(db, eventId);
    expect(rows.slice(0, 2).map((row) => [row.result, row.error])).toEqual([
      ['skipped', 'superseded'],
      ['skipped', 'superseded'],
    ]);
    await db.close();
  });

  it('skips every remaining step once the event is acknowledged', async () => {
    const { db, calendarId, base } = await ready();
    const eventId = await addEvent(db, calendarId, {
      startsAt: plusMinutes(base, 30),
    });
    await claim(db, base);

    await db.query('select * from bell.acknowledge_event($1, $2, $3, $4)', [
      eventId,
      ME,
      'app:me@example.com',
      plusMinutes(base, 1).toISOString(),
    ]);

    expect(await claim(db, plusMinutes(base, 30))).toEqual([]);
    const rows = await notificationsFor(db, eventId);
    expect(
      rows.every((row) => row.acknowledged_by === 'app:me@example.com'),
    ).toBe(true);
    expect(stepsOf(rows).slice(-1)).toEqual(['start:voice:skipped']);
    await db.close();
  });

  it('falls through to the next active channel not already in the step', async () => {
    const { db, calendarId, base } = await ready();
    const eventId = await addEvent(db, calendarId, {
      startsAt: plusMinutes(base, 30),
    });
    await claim(db, base);
    const [slack] = await notificationsFor(db, eventId);
    const { rows } = await db.query<{ id: string }>(
      "select id from bell.notifications where event_id = $1 and step = '30m' and channel = 'slack'",
      [eventId],
    );

    const first = await db.query<{
      claim_fallback: { channel: string; id: string };
    }>('select bell.claim_fallback($1, $2)', [rows[0].id, base.toISOString()]);
    const sms = first.rows[0].claim_fallback;
    const second = await db.query<{
      claim_fallback: { channel: string; id: string };
    }>('select bell.claim_fallback($1, $2)', [sms.id, base.toISOString()]);
    const voice = second.rows[0].claim_fallback;
    const third = await db.query<{ claim_fallback: unknown }>(
      'select bell.claim_fallback($1, $2)',
      [voice.id, base.toISOString()],
    );

    expect(slack.channel).toBe('slack');
    expect(sms.channel).toBe('sms');
    expect(voice.channel).toBe('voice');
    expect(third.rows[0].claim_fallback).toBeNull();
    const fallbacks = (await notificationsFor(db, eventId)).filter(
      (row) => row.step === '30m' && row.fallback_for,
    );
    expect(fallbacks.map((row) => [row.channel, row.fallback_for])).toEqual([
      ['sms', 'slack'],
      ['voice', 'sms'],
    ]);
    await db.close();
  });
});

describe('0004 event changes', () => {
  it('a move re-plans the steps and queues one moved push', async () => {
    const { db, calendarId, base } = await ready();
    const eventId = await addEvent(db, calendarId, {
      startsAt: plusMinutes(base, 30),
    });
    await claim(db, base);

    await db.query('update bell.events set starts_at = $2 where id = $1', [
      eventId,
      plusMinutes(base, 90).toISOString(),
    ]);

    expect(stepsOf(await notificationsFor(db, eventId))).toEqual([
      'moved:pushover:pending',
    ]);
    await materialize(db, plusMinutes(base, 60));
    const rows = await notificationsFor(db, eventId);
    expect(stepsOf(rows)).toHaveLength(8);
    expect(rows.find((row) => row.step === '30m')?.due_at.toISOString()).toBe(
      plusMinutes(base, 60).toISOString(),
    );
    await db.close();
  });

  it('a move far in the future queues no moved push', async () => {
    const { db, calendarId, base } = await ready();
    const eventId = await addEvent(db, calendarId, {
      startsAt: plusMinutes(base, 300),
    });

    await db.query('update bell.events set starts_at = $2 where id = $1', [
      eventId,
      plusMinutes(base, 400).toISOString(),
    ]);

    expect(await notificationsFor(db, eventId)).toEqual([]);
    await db.close();
  });

  it('a cancellation cancels every pending step', async () => {
    const { db, calendarId, base } = await ready();
    const eventId = await addEvent(db, calendarId, {
      startsAt: plusMinutes(base, 30),
    });
    await claim(db, base);

    await db.query(
      "update bell.events set status = 'cancelled' where id = $1",
      [eventId],
    );

    const pending = (await notificationsFor(db, eventId)).filter(
      (row) => row.step !== '30m',
    );
    expect(pending.every((row) => row.result === 'cancelled')).toBe(true);
    expect(await claim(db, plusMinutes(base, 30))).toEqual([]);
    await db.close();
  });

  it('a status change without a move keeps an early acknowledgement', async () => {
    const { db, calendarId, base } = await ready();
    const eventId = await addEvent(db, calendarId, {
      startsAt: plusMinutes(base, 30),
    });
    await db.query('select * from bell.acknowledge_event($1, $2, $3, $4)', [
      eventId,
      ME,
      'app:me@example.com',
      plusMinutes(base, -1).toISOString(),
    ]);

    await db.query(
      "update bell.events set status = 'tentative' where id = $1",
      [eventId],
    );

    const rows = await notificationsFor(db, eventId);
    expect(rows).toHaveLength(7);
    expect(
      rows.every((row) => row.acknowledged_by === 'app:me@example.com'),
    ).toBe(true);
    expect(await claim(db, plusMinutes(base, 30))).toEqual([]);
    await db.close();
  });

  it.each([
    ['cancelled', "status = 'cancelled'"],
    ['moved', "starts_at = starts_at + interval '1 hour'"],
  ])(
    'a %s meeting queues the receipt of its live emergency push, once',
    async (_change, assignment) => {
      const { db, calendarId, base } = await ready();
      const eventId = await addEvent(db, calendarId, {
        startsAt: plusMinutes(base, 2),
      });
      await db.query(
        `update bell.notifications set claimed_at = now(), sent_at = now(), result = 'sent', provider_ref = 'receipt-9'
         where event_id = $1 and step = '2m' and channel = 'pushover'`,
        [eventId],
      );

      await db.query(`update bell.events set ${assignment} where id = $1`, [
        eventId,
      ]);
      const taken = await db.query<{ take_stale_receipts: string }>(
        'select * from bell.take_stale_receipts()',
      );
      const again = await db.query('select * from bell.take_stale_receipts()');

      expect(taken.rows.map((row) => row.take_stale_receipts)).toEqual([
        'receipt-9',
      ]);
      expect(again.rows).toEqual([]);
      await db.close();
    },
  );

  it('an acknowledged emergency push is not queued again on cancel', async () => {
    const { db, calendarId, base } = await ready();
    const eventId = await addEvent(db, calendarId, {
      startsAt: plusMinutes(base, 2),
    });
    await db.query(
      `update bell.notifications set claimed_at = now(), sent_at = now(), result = 'sent', provider_ref = 'receipt-9'
       where event_id = $1 and step = '2m' and channel = 'pushover'`,
      [eventId],
    );
    await db.query('select * from bell.acknowledge_event($1, $2, $3, now())', [
      eventId,
      ME,
      'app:me@example.com',
    ]);

    await db.query(
      "update bell.events set status = 'cancelled' where id = $1",
      [eventId],
    );

    const taken = await db.query('select * from bell.take_stale_receipts()');
    expect(taken.rows).toEqual([]);
    await db.close();
  });

  it('the same sync applied twice changes nothing', async () => {
    const { db, calendarId, base } = await ready();
    const eventId = await addEvent(db, calendarId, {
      startsAt: plusMinutes(base, 30),
    });
    await claim(db, base);
    const before = await notificationsFor(db, eventId);

    await db.query(
      "update bell.events set title = 'Client sync', status = 'confirmed' where id = $1",
      [eventId],
    );

    expect(await notificationsFor(db, eventId)).toEqual(before);
    await db.close();
  });
});

describe('0004 access', () => {
  it('lets a user read only their own channels and notifications, never secrets', async () => {
    const { db, calendarId, base } = await ready();
    await saveChannel(db, NEIGHBOUR, ['sms'], '+15125550199');
    await addEvent(db, calendarId, { startsAt: plusMinutes(base, 30) });

    await actAs(db, NEIGHBOUR);
    const channels = await db.query<{ kind: string }>(
      'select * from bell.channels',
    );
    const notifications = await db.query('select * from bell.notifications');
    await expect(
      db.query('select * from bell.channel_secrets'),
    ).rejects.toThrow();
    await expect(
      db.query('select * from bell.slack_installs'),
    ).rejects.toThrow();
    await expect(
      db.query('select * from bell.stale_receipts'),
    ).rejects.toThrow();
    await expect(
      db.query('update bell.channels set active = false'),
    ).rejects.toThrow();
    await expect(
      db.query('select bell.claim_due_notifications(now())'),
    ).rejects.toThrow();
    await actAsOwner(db);

    expect(channels.rows.map((row) => row.kind)).toEqual(['sms']);
    expect(notifications.rows).toEqual([]);
    await db.close();
  });

  it.each([
    ['a Bell-only user', false],
    ['a user who keeps a Commander profile', true],
  ])(
    'delete_me removes channels, secrets and notifications of %s but keeps the shared Slack install',
    async (_who, hasProfile) => {
      const { db, calendarId, base } = await ready();
      await db.exec(
        'create table public.profiles (user_id uuid primary key references auth.users(id))',
      );
      if (hasProfile) {
        await db.query('insert into public.profiles (user_id) values ($1)', [
          ME,
        ]);
      }
      const eventId = await addEvent(db, calendarId, {
        startsAt: plusMinutes(base, 30),
      });
      await db.query(
        "insert into bell.stale_receipts (receipt, user_id, event_id) values ('receipt-9', $1, $2)",
        [ME, eventId],
      );
      await actAs(db, ME);

      const removable = await db.query<{ delete_me: boolean }>(
        'select bell.delete_me()',
      );
      await actAsOwner(db);

      const counts = await db.query<{ n: number }>(
        `select count(*)::int as n from bell.channels where user_id = $1
       union all select count(*)::int from bell.channel_secrets where user_id = $1
       union all select count(*)::int from bell.notifications where user_id = $1
       union all select count(*)::int from bell.stale_receipts where user_id = $1
       union all select count(*)::int from bell.channel_secrets where value = $2`,
        [ME, PHONE],
      );
      const install = await db.query<{ installed_by: string | null }>(
        'select installed_by from bell.slack_installs',
      );
      const neighbour = await db.query<{ n: number }>(
        'select count(*)::int as n from bell.users where id = $1',
        [NEIGHBOUR],
      );
      expect(removable.rows[0].delete_me).toBe(!hasProfile);
      expect(counts.rows.map((row) => row.n)).toEqual([0, 0, 0, 0, 0]);
      expect(install.rows).toEqual([{ installed_by: null }]);
      expect(neighbour.rows[0].n).toBe(1);
      await db.close();
    },
  );
});
