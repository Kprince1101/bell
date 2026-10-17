import { buildHealthPanel } from '@/lib/health/panel';
import { summarizePanel, summaryTone } from '@/lib/health/summary';
import type { HealthPanel, HealthReport, HealthTone } from '@/types/health';
import {
  HEALTH_NOW,
  fullEnv,
  greenReport,
  minutesAgo,
} from '@/test-utils/healthFixtures';

const panelOf = (
  report: HealthReport,
  env: Record<string, string | undefined> = fullEnv(),
): HealthPanel => buildHealthPanel(report, env, HEALTH_NOW);

const find = (panel: HealthPanel, key: string) =>
  panel.sections
    .flatMap((section) => section.checks)
    .find((check) => check.key === key);

const toneOf = (panel: HealthPanel, key: string): HealthTone | undefined =>
  find(panel, key)?.tone;

describe('buildHealthPanel', () => {
  it('is green across the board once the runbook has been followed', () => {
    const panel = panelOf(greenReport());

    expect(panel.redCount).toBe(0);
    expect(panel.checkedAt).toBe(HEALTH_NOW.toISOString());
    expect(panel.sections.map((section) => section.key)).toEqual([
      'scheduler',
      'jobs',
      'notifications',
      'channels',
      'sources',
      'secrets',
    ]);
    expect(find(panel, 'cron-job')?.detail).toBe('Scheduled * * * * *');
    expect(find(panel, 'last-sent')?.detail).toBe('Pushover, 2m step, 1 h ago');
  });

  it('turns the cron run and bell-notify red once older than five minutes', () => {
    const report = greenReport();
    report.cron.last_run = {
      status: 'succeeded',
      started_at: minutesAgo(6),
      message: null,
    };
    report.runs[0] = { ...report.runs[0], ran_at: minutesAgo(6) };

    const panel = panelOf(report);

    expect(toneOf(panel, 'cron-run')).toBe('red');
    expect(find(panel, 'cron-run')?.detail).toBe('Last ran 6 min ago.');
    expect(toneOf(panel, 'bell-notify')).toBe('red');
    expect(find(panel, 'bell-notify')?.detail).toContain(
      'Last ran 6 min ago. If the cron run is green',
    );
    expect(panel.redCount).toBe(2);
  });

  it('a running cron job with a stale tick points at the cron secret', () => {
    const report = greenReport();
    report.runs[0] = { ...report.runs[0], ran_at: minutesAgo(30) };

    const panel = panelOf(report);

    expect(toneOf(panel, 'cron-run')).toBe('green');
    expect(find(panel, 'bell-notify')?.detail).toContain('CRON_SECRET');
  });

  it('keeps them green at exactly five minutes', () => {
    const report = greenReport();
    report.cron.last_run = {
      status: 'succeeded',
      started_at: minutesAgo(5),
      message: null,
    };
    report.runs[0] = { ...report.runs[0], ran_at: minutesAgo(5) };

    const panel = panelOf(report);

    expect(toneOf(panel, 'cron-run')).toBe('green');
    expect(toneOf(panel, 'bell-notify')).toBe('green');
  });

  it('does not age out bell-sync, which only runs when Google pushes', () => {
    const report = greenReport();
    report.runs[1] = { ...report.runs[1], ran_at: minutesAgo(60 * 24 * 3) };

    expect(toneOf(panelOf(report), 'bell-sync')).toBe('green');
  });

  it('explains a missing scheduler', () => {
    const report = greenReport();
    report.cron = {
      installed: false,
      job: null,
      last_run: null,
    };

    const panel = panelOf(report);

    expect(find(panel, 'cron-job')?.detail).toBe('pg_cron is not enabled.');
    expect(find(panel, 'cron-run')?.detail).toBe('Never ran.');
  });

  it('flags a job that is missing or switched off', () => {
    const missing = greenReport();
    missing.cron.job = null;
    const off = greenReport();
    off.cron.job = { schedule: '* * * * *', active: false };

    expect(find(panelOf(missing), 'cron-job')?.detail).toBe(
      'No job named bell-notify.',
    );
    expect(find(panelOf(off), 'cron-job')?.detail).toBe(
      'The job is switched off.',
    );
  });

  it('shows a failed cron run and failed jobs with their reasons', () => {
    const report = greenReport();
    report.cron.last_run = {
      status: 'failed',
      started_at: minutesAgo(1),
      message: 'permission denied for schema net',
    };
    report.runs = [
      {
        job: 'bell-notify',
        ran_at: minutesAgo(1),
        ok: false,
        detail: 'Pushover: invalid token',
      },
      {
        job: 'bell-sync',
        ran_at: minutesAgo(1),
        ok: false,
        detail: 'invalid_grant',
      },
    ];

    const panel = panelOf(report);

    expect(find(panel, 'cron-run')?.detail).toBe(
      'Failed 1 min ago: permission denied for schema net',
    );
    expect(find(panel, 'bell-notify')?.detail).toBe(
      'Failed 1 min ago: Pushover: invalid token',
    );
    expect(find(panel, 'bell-sync')?.detail).toBe(
      'Failed 1 min ago: invalid_grant',
    );
  });

  it('reports jobs that never ran', () => {
    const report = greenReport();
    report.runs = [];

    const panel = panelOf(report);

    expect(find(panel, 'bell-notify')?.detail).toMatch(/^Never ran\. /);
    expect(find(panel, 'bell-sync')?.detail).toBe(
      'No calendar has synced yet.',
    );
  });

  it('is red until a notification has been sent and when a failure came after it', () => {
    const none = greenReport();
    none.last_sent = null;
    const failed = greenReport();
    failed.last_failed = {
      at: minutesAgo(10),
      step: 'start',
      channel: 'voice',
      error: 'Twilio: 21215',
    };
    const healed = greenReport();
    healed.last_failed = {
      at: minutesAgo(200),
      step: 'start',
      channel: 'voice',
      error: 'Twilio: 21215',
    };

    expect(find(panelOf(none), 'last-sent')?.detail).toBe('None sent yet.');
    expect(find(panelOf(failed), 'last-failure')).toMatchObject({
      tone: 'red',
      detail: 'Phone call failed 10 min ago: Twilio: 21215',
    });
    expect(toneOf(panelOf(healed), 'last-failure')).toBe('green');
  });

  it('shows each channel: off is grey, untested or failed tests are red', () => {
    const report = greenReport();
    report.channels = [
      {
        kind: 'slack',
        active: false,
        tested_at: null,
        test_ok: null,
        test_error: null,
      },
      {
        kind: 'pushover',
        active: true,
        tested_at: null,
        test_ok: null,
        test_error: null,
      },
      {
        kind: 'sms',
        active: true,
        tested_at: minutesAgo(3),
        test_ok: false,
        test_error: 'Twilio: 21211 invalid To',
      },
    ];

    const panel = panelOf(report);

    expect(find(panel, 'channel-slack')).toMatchObject({
      tone: 'grey',
      label: 'Slack DM',
    });
    expect(find(panel, 'channel-pushover')?.detail).toBe(
      'Never tested. Press Test on Notifications.',
    );
    expect(find(panel, 'channel-sms')?.detail).toBe(
      'Test failed 3 min ago: Twilio: 21211 invalid To',
    );
  });

  it('is red with no channels and no calendars', () => {
    const report = greenReport();
    report.channels = [];
    report.sources = [];

    const panel = panelOf(report);

    expect(toneOf(panel, 'channels-none')).toBe('red');
    expect(toneOf(panel, 'sources-none')).toBe('red');
  });

  it('shows each calendar: unhealthy or without a live push channel is red', () => {
    const report = greenReport();
    const source = report.sources[0];
    report.sources = [
      { ...source, id: 'a', healthy: false, last_error: 'invalid_grant' },
      { ...source, id: 'b', channel_expires_at: minutesAgo(1) },
      { ...source, id: 'c', last_sync_at: null },
    ];

    const panel = panelOf(report);

    expect(find(panel, 'source-a')).toMatchObject({
      tone: 'red',
      label: 'Work (me@example.com)',
      detail: 'Unhealthy: invalid_grant',
    });
    expect(find(panel, 'source-b')?.detail).toBe(
      'Push channel missing or expired.',
    );
    expect(toneOf(panel, 'source-c')).toBe('grey');
  });

  it('lists every app secret by name and never its value', () => {
    const env: Record<string, string | undefined> = {
      ...fullEnv(),
      TWILIO_AUTH_TOKEN: '  ',
      PUSHOVER_APP_TOKEN: undefined,
    };

    const panel = panelOf(greenReport(), env);
    const secrets = panel.sections.find((section) => section.key === 'secrets');

    expect(find(panel, 'env-TWILIO_AUTH_TOKEN')?.tone).toBe('red');
    expect(find(panel, 'env-PUSHOVER_APP_TOKEN')?.detail).toBe('Missing');
    expect(JSON.stringify(secrets)).not.toContain('configured');
    expect(panel.redCount).toBe(2);
  });
});

describe('summary', () => {
  it('says all green or how many checks are red', () => {
    expect(summarizePanel(0)).toBe('All green.');
    expect(summarizePanel(1)).toBe('1 check is red.');
    expect(summarizePanel(4)).toBe('4 checks are red.');
    expect(summaryTone(0)).toBe('green');
    expect(summaryTone(2)).toBe('red');
  });
});
