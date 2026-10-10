import { APP_SECRET_NAMES } from '@/lib/health/panel';
import type { HealthReport } from '@/types/health';

export const HEALTH_NOW = new Date('2026-10-10T18:00:00.000Z');

export const minutesAgo = (minutes: number): string =>
  new Date(HEALTH_NOW.getTime() - minutes * 60_000).toISOString();

export const greenReport = (): HealthReport => ({
  cron: {
    installed: true,
    job: { schedule: '* * * * *', active: true },
    last_run: {
      status: 'succeeded',
      started_at: minutesAgo(0.5),
      message: '1 row',
    },
  },
  runs: [
    {
      job: 'bell-notify',
      ran_at: minutesAgo(0.5),
      ok: true,
      detail: 'sent=0 failed=0 renewed=0',
    },
    { job: 'bell-sync', ran_at: minutesAgo(240), ok: true, detail: null },
  ],
  last_sent: { at: minutesAgo(90), step: '2m', channel: 'pushover' },
  last_failed: null,
  channels: [
    {
      kind: 'pushover',
      active: true,
      tested_at: minutesAgo(120),
      test_ok: true,
      test_error: null,
    },
    {
      kind: 'sms',
      active: true,
      tested_at: minutesAgo(120),
      test_ok: true,
      test_error: null,
    },
  ],
  sources: [
    {
      id: 'cal-1',
      label: 'Work',
      account: 'me@example.com',
      healthy: true,
      last_sync_at: minutesAgo(240),
      last_error: null,
      channel_expires_at: new Date(
        HEALTH_NOW.getTime() + 3 * 86_400_000,
      ).toISOString(),
    },
  ],
});

export const fullEnv = (): Record<string, string> =>
  Object.fromEntries(APP_SECRET_NAMES.map((name) => [name, 'configured']));
