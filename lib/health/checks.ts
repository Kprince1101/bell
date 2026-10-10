import { CHANNEL_LABELS } from '@/lib/constants';
import { formatAge, isPast, isStale } from '@/lib/health/staleness';
import type {
  HealthCheck,
  HealthReport,
  HealthTone,
  JobName,
} from '@/types/health';

type CronReport = HealthReport['cron'];
type RunReport = HealthReport['runs'][number];
type ChannelReport = HealthReport['channels'][number];
type SourceReport = HealthReport['sources'][number];

const check = (
  key: string,
  label: string,
  tone: HealthTone,
  detail: string,
): HealthCheck => ({ key, label, tone, detail });

const withReason = (text: string, reason: string | null): string => {
  if (!reason) return text;
  return `${text}: ${reason}`;
};

const cronJobCheck = (cron: CronReport): HealthCheck => {
  const label = 'pg_cron job bell-notify';
  if (!cron.installed) {
    return check('cron-job', label, 'red', 'pg_cron is not enabled.');
  }
  if (!cron.job) {
    return check('cron-job', label, 'red', 'No job named bell-notify.');
  }
  if (!cron.job.active) {
    return check('cron-job', label, 'red', 'The job is switched off.');
  }
  return check('cron-job', label, 'green', `Scheduled ${cron.job.schedule}`);
};

const cronRunCheck = (cron: CronReport, now: Date): HealthCheck => {
  const label = 'Last cron run';
  const run = cron.last_run;
  if (!run?.started_at) return check('cron-run', label, 'red', 'Never ran.');
  const age = formatAge(run.started_at, now);
  if (run.status === 'failed') {
    return check(
      'cron-run',
      label,
      'red',
      withReason(`Failed ${age}`, run.message),
    );
  }
  if (isStale(run.started_at, now)) {
    return check('cron-run', label, 'red', `Last ran ${age}.`);
  }
  return check('cron-run', label, 'green', `${run.status} ${age}`);
};

export const schedulerChecks = (cron: CronReport, now: Date): HealthCheck[] => [
  cronJobCheck(cron),
  cronRunCheck(cron, now),
];

const TICK_NOT_REACHED =
  'If the cron run is green, /api/tick is not finishing: check CRON_SECRET in Vault and Vercel, and the Vercel logs.';

const findRun = (runs: RunReport[], job: JobName): RunReport | null =>
  runs.find((run) => run.job === job) ?? null;

const notifyRunCheck = (run: RunReport | null, now: Date): HealthCheck => {
  const label = 'bell-notify (scheduler tick)';
  if (!run) {
    return check('bell-notify', label, 'red', `Never ran. ${TICK_NOT_REACHED}`);
  }
  const age = formatAge(run.ran_at, now);
  if (!run.ok) {
    return check(
      'bell-notify',
      label,
      'red',
      withReason(`Failed ${age}`, run.detail),
    );
  }
  if (isStale(run.ran_at, now)) {
    return check(
      'bell-notify',
      label,
      'red',
      `Last ran ${age}. ${TICK_NOT_REACHED}`,
    );
  }
  return check(
    'bell-notify',
    label,
    'green',
    withReason(`OK ${age}`, run.detail),
  );
};

const syncRunCheck = (run: RunReport | null, now: Date): HealthCheck => {
  const label = 'bell-sync (Google push sync)';
  if (!run) {
    return check('bell-sync', label, 'red', 'No calendar has synced yet.');
  }
  const age = formatAge(run.ran_at, now);
  if (!run.ok) {
    return check(
      'bell-sync',
      label,
      'red',
      withReason(`Failed ${age}`, run.detail),
    );
  }
  return check('bell-sync', label, 'green', `OK ${age}`);
};

export const jobChecks = (runs: RunReport[], now: Date): HealthCheck[] => [
  notifyRunCheck(findRun(runs, 'bell-notify'), now),
  syncRunCheck(findRun(runs, 'bell-sync'), now),
];

const failedSinceLastSent = (report: HealthReport): boolean => {
  const failed = report.last_failed;
  if (!failed) return false;
  if (!report.last_sent) return true;
  return new Date(failed.at) > new Date(report.last_sent.at);
};

const lastSentCheck = (report: HealthReport, now: Date): HealthCheck => {
  const label = 'Last notification sent';
  const sent = report.last_sent;
  if (!sent) return check('last-sent', label, 'red', 'None sent yet.');
  return check(
    'last-sent',
    label,
    'green',
    `${CHANNEL_LABELS[sent.channel]}, ${sent.step} step, ${formatAge(sent.at, now)}`,
  );
};

const failureCheck = (report: HealthReport, now: Date): HealthCheck => {
  const label = 'Delivery failures';
  const failed = report.last_failed;
  if (!failed || !failedSinceLastSent(report)) {
    return check(
      'last-failure',
      label,
      'green',
      'None since the last notification sent.',
    );
  }
  return check(
    'last-failure',
    label,
    'red',
    withReason(
      `${CHANNEL_LABELS[failed.channel]} failed ${formatAge(failed.at, now)}`,
      failed.error,
    ),
  );
};

export const notificationChecks = (
  report: HealthReport,
  now: Date,
): HealthCheck[] => [lastSentCheck(report, now), failureCheck(report, now)];

const channelCheck = (channel: ChannelReport, now: Date): HealthCheck => {
  const key = `channel-${channel.kind}`;
  const label = CHANNEL_LABELS[channel.kind];
  if (!channel.active) return check(key, label, 'grey', 'Switched off.');
  if (!channel.tested_at) {
    return check(
      key,
      label,
      'red',
      'Never tested. Press Test on Notifications.',
    );
  }
  const age = formatAge(channel.tested_at, now);
  if (!channel.test_ok) {
    return check(
      key,
      label,
      'red',
      withReason(`Test failed ${age}`, channel.test_error),
    );
  }
  return check(key, label, 'green', `Test sent ${age}`);
};

export const channelChecks = (
  channels: ChannelReport[],
  now: Date,
): HealthCheck[] => {
  if (!channels.length) {
    return [
      check(
        'channels-none',
        'Channels',
        'red',
        'No channel set up. Add one on Notifications.',
      ),
    ];
  }
  return channels.map((channel) => channelCheck(channel, now));
};

const sourceCheck = (source: SourceReport, now: Date): HealthCheck => {
  const key = `source-${source.id}`;
  const label = `${source.label} (${source.account})`;
  if (!source.healthy) {
    return check(
      key,
      label,
      'red',
      `Unhealthy: ${source.last_error ?? 'sync is failing'}`,
    );
  }
  if (isPast(source.channel_expires_at, now)) {
    return check(key, label, 'red', 'Push channel missing or expired.');
  }
  if (!source.last_sync_at) {
    return check(key, label, 'grey', 'Waiting for first sync.');
  }
  return check(
    key,
    label,
    'green',
    `Last synced ${formatAge(source.last_sync_at, now)}`,
  );
};

export const sourceChecks = (
  sources: SourceReport[],
  now: Date,
): HealthCheck[] => {
  if (!sources.length) {
    return [
      check(
        'sources-none',
        'Calendars',
        'red',
        'No calendar included. Connect one on Calendars.',
      ),
    ];
  }
  return sources.map((source) => sourceCheck(source, now));
};

export const secretChecks = (
  names: string[],
  env: Record<string, string | undefined>,
): HealthCheck[] =>
  names.map((name) => {
    if (env[name]?.trim()) return check(`env-${name}`, name, 'green', 'Set');
    return check(`env-${name}`, name, 'red', 'Missing');
  });
