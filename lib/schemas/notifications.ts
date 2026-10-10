import { z } from 'zod';

export const CHANNEL_KINDS = ['slack', 'pushover', 'sms', 'voice'] as const;
export const NOTIFY_STEPS = ['30m', '10m', '2m', 'start', 'moved'] as const;

export const channelKind = z.enum(CHANNEL_KINDS);
export const notifyStep = z.enum(NOTIFY_STEPS);

export const deliverySchema = z.object({
  id: z.string(),
  event_id: z.string(),
  user_id: z.string(),
  step: notifyStep,
  channel: channelKind,
  due_at: z.string(),
  provider_ref: z.string().nullable(),
  title: z.string(),
  starts_at: z.string(),
  source_tz: z.string().nullable(),
  join_url: z.string().nullable(),
  time_zone: z.string(),
  target: z.string().nullable(),
  slack_team_id: z.string().nullable(),
  slack_bot_token: z.string().nullable(),
  slack_ref: z.string().nullable(),
});

export const channelTargetSchema = z.object({
  target: z.string(),
  slack_team_id: z.string().nullable(),
  slack_bot_token: z.string().nullable(),
});

export const pushoverKeyBody = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{30}$/, 'A Pushover user key is 30 letters and digits'),
});

export const phoneBody = z.object({
  number: z
    .string()
    .transform((value) => value.replace(/[\s().-]/g, ''))
    .pipe(
      z
        .string()
        .regex(
          /^\+[1-9]\d{7,14}$/,
          'Use the international format, e.g. +15125550100',
        ),
    ),
});

export const channelToggleBody = z.object({
  kind: channelKind,
  active: z.boolean(),
});

export const channelTestBody = z.object({ kind: channelKind });

export const quietBody = z.object({
  calendarId: z.uuid(),
  quiet: z.boolean(),
});

export const acknowledgeBody = z.object({ eventId: z.uuid() });

export const slackActionPayload = z.object({
  type: z.string(),
  user: z.object({ id: z.string(), name: z.string().optional() }),
  team: z.object({ id: z.string() }),
  response_url: z.string().optional(),
  actions: z
    .array(
      z.object({
        action_id: z.string(),
        value: z.string().optional(),
      }),
    )
    .default([]),
});

export const pushoverCallbackBody = z.object({
  receipt: z.string(),
  acknowledged: z.string(),
  acknowledged_at: z.string().optional(),
  acknowledged_by: z.string().optional(),
});
