import type { AdminClient } from '@/lib/account';
import {
  channelChecks,
  jobChecks,
  notificationChecks,
  schedulerChecks,
  secretChecks,
  sourceChecks,
} from '@/lib/health/checks';
import { healthReportSchema } from '@/lib/schemas/health';
import secretsManifest from '@/supabase/functions/secrets.json';
import type { HealthPanel, HealthReport, HealthSection } from '@/types/health';

export type HealthEnv = Record<string, string | undefined>;

export const APP_SECRET_NAMES: string[] = secretsManifest.app;

export const buildHealthPanel = (
  report: HealthReport,
  env: HealthEnv,
  now: Date,
): HealthPanel => {
  const sections: HealthSection[] = [
    {
      key: 'scheduler',
      title: 'Scheduler',
      checks: schedulerChecks(report.cron, now),
    },
    { key: 'jobs', title: 'Jobs', checks: jobChecks(report.runs, now) },
    {
      key: 'notifications',
      title: 'Notifications',
      checks: notificationChecks(report, now),
    },
    {
      key: 'channels',
      title: 'Your channels',
      checks: channelChecks(report.channels, now),
    },
    {
      key: 'sources',
      title: 'Your calendars',
      checks: sourceChecks(report.sources, now),
    },
    {
      key: 'secrets',
      title: 'App secrets (names only)',
      checks: secretChecks(APP_SECRET_NAMES, env),
    },
  ];
  return {
    checkedAt: now.toISOString(),
    redCount: sections
      .flatMap((section) => section.checks)
      .filter((check) => check.tone === 'red').length,
    sections,
  };
};

export const loadHealthReport = async (
  admin: AdminClient,
  userId: string,
): Promise<HealthReport> => {
  const { data, error } = await admin.rpc('health_report', {
    p_user_id: userId,
  });
  if (error) throw error;
  return healthReportSchema.parse(data);
};

export const loadHealthPanel = async (
  admin: AdminClient,
  userId: string,
  env: HealthEnv,
  now: Date,
): Promise<HealthPanel> =>
  buildHealthPanel(await loadHealthReport(admin, userId), env, now);
