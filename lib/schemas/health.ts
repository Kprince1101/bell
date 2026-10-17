import { z } from 'zod';
import { channelKind, notifyStep } from '@/lib/schemas/notifications';

export const JOB_NAMES = ['bell-sync', 'bell-notify'] as const;

const timestamp = z.string();

export const healthReportSchema = z.object({
  cron: z.object({
    installed: z.boolean(),
    job: z.object({ schedule: z.string(), active: z.boolean() }).nullable(),
    last_run: z
      .object({
        status: z.string(),
        started_at: timestamp.nullable(),
        message: z.string().nullable(),
      })
      .nullable(),
  }),
  runs: z.array(
    z.object({
      job: z.enum(JOB_NAMES),
      ran_at: timestamp,
      ok: z.boolean(),
      detail: z.string().nullable(),
    }),
  ),
  last_sent: z
    .object({ at: timestamp, step: notifyStep, channel: channelKind })
    .nullable(),
  last_failed: z
    .object({
      at: timestamp,
      step: notifyStep,
      channel: channelKind,
      error: z.string().nullable(),
    })
    .nullable(),
  channels: z.array(
    z.object({
      kind: channelKind,
      active: z.boolean(),
      tested_at: timestamp.nullable(),
      test_ok: z.boolean().nullable(),
      test_error: z.string().nullable(),
    }),
  ),
  sources: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      account: z.string(),
      healthy: z.boolean(),
      last_sync_at: timestamp.nullable(),
      last_error: z.string().nullable(),
      channel_expires_at: timestamp.nullable(),
    }),
  ),
});
