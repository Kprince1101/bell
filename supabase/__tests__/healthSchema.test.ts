import type { PGlite } from '@electric-sql/pglite';
import { loadHealthReport } from '@/lib/health/panel';
import { testChannel } from '@/lib/notify/channels';
import { createNotifyRepo } from '@/lib/notify/repo';
import { actAs, actAsOwner } from '@/supabase/testing/pglite';
import { createPgliteAdmin } from '@/supabase/testing/pgliteAdmin';
import {
  ME,
  NEIGHBOUR,
  addEvent,
  connectEveryChannel,
  createNotifyDb,
  plusMinutes,
  saveChannel,
  thisMinute,
} from '@/supabase/testing/notifySeed';
import { createFakeNotifyServices } from '@/test-utils/notifyFakes';

const PG_CRON = `
  create schema cron;
  create table cron.job (jobid bigint primary key, jobname text, schedule text, active boolean);
  create table cron.job_run_details (
    runid bigserial primary key, jobid bigint, status text, return_message text, start_time timestamptz
  );
`;

const lastRuns = async (db: PGlite) =>
  (
    await db.query<{ job: string; ok: boolean; detail: string | null }>(
      'select job, ok, detail from bell.job_runs order by job',
    )
  ).rows;

const report = (db: PGlite, userId: string = ME) =>
  loadHealthReport(createPgliteAdmin(db), userId);

describe('0005 run records', () => {
  it('records every sync and every sync failure as the last bell-sync run', async () => {
    const { db, calendarId } = await createNotifyDb();
    const seenAt = thisMinute().toISOString();

    await db.query(
      "select bell.apply_sync($1, '[]'::jsonb, '{}', 'token-1', false, now(), $2)",
      [calendarId, seenAt],
    );
    const afterSync = await lastRuns(db);
    await db.query("select bell.record_sync_failure($1, 'invalid_grant')", [
      calendarId,
    ]);

    expect(afterSync).toEqual([{ job: 'bell-sync', ok: true, detail: null }]);
    expect(await lastRuns(db)).toEqual([
      { job: 'bell-sync', ok: false, detail: 'invalid_grant' },
    ]);
    await db.close();
  });

  it('keeps one row per job, the latest', async () => {
    const { db } = await createNotifyDb();
    const repo = createNotifyRepo(createPgliteAdmin(db));

    await repo.recordJobRun({
      job: 'bell-notify',
      ok: false,
      detail: 'boom',
      at: plusMinutes(thisMinute(), -1).toISOString(),
    });
    await repo.recordJobRun({
      job: 'bell-notify',
      ok: true,
      detail: 'sent=1 failed=0 renewed=0',
      at: thisMinute().toISOString(),
    });

    expect(await lastRuns(db)).toEqual([
      { job: 'bell-notify', ok: true, detail: 'sent=1 failed=0 renewed=0' },
    ]);
    await db.close();
  });

  it('Test records the last result of each channel', async () => {
    const { db } = await createNotifyDb();
    const { services, twilio } = createFakeNotifyServices({
      repo: createNotifyRepo(createPgliteAdmin(db)),
    });
    await connectEveryChannel(db, ME);
    twilio.sendSms.mockRejectedValue(new Error('Twilio: 21211 invalid To'));

    await testChannel(services, ME, 'pushover');
    await expect(testChannel(services, ME, 'sms')).rejects.toMatchObject({
      status: 502,
    });

    const { channels } = await report(db);
    expect(
      channels.map(({ kind, active, test_ok, test_error }) => ({
        kind,
        active,
        test_ok,
        test_error,
      })),
    ).toEqual([
      { kind: 'slack', active: true, test_ok: null, test_error: null },
      { kind: 'pushover', active: true, test_ok: true, test_error: null },
      {
        kind: 'sms',
        active: true,
        test_ok: false,
        test_error: 'Twilio: 21211 invalid To',
      },
      { kind: 'voice', active: true, test_ok: null, test_error: null },
    ]);
    await db.close();
  });
});

describe('0005 health_report', () => {
  it('says pg_cron is missing and shows only the caller’s channels and calendars', async () => {
    const { db } = await createNotifyDb();
    await saveChannel(db, ME, ['pushover'], 'u'.repeat(30));
    await saveChannel(db, NEIGHBOUR, ['sms'], '+15125550199');

    const health = await report(db);

    expect(health.cron).toEqual({
      installed: false,
      job: null,
      last_run: null,
    });
    expect(health.runs).toEqual([]);
    expect(health.channels.map((channel) => channel.kind)).toEqual([
      'pushover',
    ]);
    expect(health.sources).toEqual([
      expect.objectContaining({
        label: 'Work',
        account: 'me@example.com',
        healthy: true,
        channel_expires_at: null,
      }),
    ]);
    await db.close();
  });

  it('reads only the bell-notify job and its last run among the shared project’s cron jobs', async () => {
    const { db } = await createNotifyDb();
    await db.exec(PG_CRON);
    await db.exec(`
      insert into cron.job values (7, 'bell-notify', '* * * * *', true), (8, 'commander-digest', '0 * * * *', false);
      insert into cron.job_run_details (jobid, status, return_message, start_time) values
        (7, 'succeeded', '1 row', now() - interval '2 minutes'),
        (7, 'failed', 'permission denied', now() - interval '1 minute'),
        (8, 'succeeded', 'commander job', now());
    `);

    const { cron } = await report(db);

    expect(cron).toEqual({
      installed: true,
      job: { schedule: '* * * * *', active: true },
      last_run: expect.objectContaining({
        status: 'failed',
        message: 'permission denied',
      }),
    });
    await db.close();
  });

  it('reports the last notification sent and the last one that failed', async () => {
    const { db, calendarId } = await createNotifyDb();
    await connectEveryChannel(db, ME);
    const base = thisMinute();
    await addEvent(db, calendarId, { startsAt: plusMinutes(base, 30) });
    await db.query(
      `update bell.notifications set claimed_at = $1, sent_at = $1, result = 'sent'
       where step = '30m' and channel = 'pushover'`,
      [plusMinutes(base, -2).toISOString()],
    );
    await db.query(
      `update bell.notifications set claimed_at = $1, result = 'failed', error = 'Slack: not_in_channel'
       where step = '30m' and channel = 'slack'`,
      [plusMinutes(base, -1).toISOString()],
    );

    const health = await report(db);

    expect(health.last_sent).toMatchObject({
      step: '30m',
      channel: 'pushover',
    });
    expect(health.last_failed).toMatchObject({
      step: '30m',
      channel: 'slack',
      error: 'Slack: not_in_channel',
    });
    await db.close();
  });
});

describe('0005 access', () => {
  it('a signed-in user can neither read run records nor call the health functions', async () => {
    const { db } = await createNotifyDb();
    await actAs(db, ME);

    await expect(db.query('select * from bell.job_runs')).rejects.toThrow();
    await expect(
      db.query('select * from bell.channel_tests'),
    ).rejects.toThrow();
    await expect(
      db.query('select bell.health_report($1)', [ME]),
    ).rejects.toThrow();
    await expect(
      db.query("select bell.record_job_run('bell-notify', true, null, now())"),
    ).rejects.toThrow();
    await actAsOwner(db);
    await db.close();
  });

  it('delete_me removes the user’s channel test results', async () => {
    const { db } = await createNotifyDb();
    await saveChannel(db, ME, ['pushover'], 'u'.repeat(30));
    await db.query(
      "select bell.record_channel_test($1, 'pushover', true, null, now())",
      [ME],
    );
    await actAs(db, ME);

    await db.query('select bell.delete_me()');
    await actAsOwner(db);

    const { rows } = await db.query<{ n: number }>(
      'select count(*)::int as n from bell.channel_tests',
    );
    expect(rows[0].n).toBe(0);
    await db.close();
  });
});
