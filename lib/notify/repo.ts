import { z } from 'zod';
import type { AdminClient } from '@/lib/account';
import type { NotifyRepo } from '@/lib/notify/services';
import {
  channelTargetSchema,
  deliverySchema,
} from '@/lib/schemas/notifications';
import type { Delivery } from '@/types/notifications';

type RpcResult<Data> = { data: Data; error: null } | { error: Error };

const unwrap = <Data>(result: RpcResult<Data>): Data => {
  if (result.error) throw result.error;
  return result.data;
};

const deliveries = z.array(deliverySchema);

const toDelivery = (raw: unknown): Delivery | null => {
  if (raw === null || raw === undefined) return null;
  return deliverySchema.parse(raw);
};

export const createNotifyRepo = (admin: AdminClient): NotifyRepo => ({
  materialize: async (now) =>
    unwrap(await admin.rpc('materialize_notifications', { p_now: now })) ?? 0,

  claimDue: async (now) =>
    deliveries.parse(
      unwrap(await admin.rpc('claim_due_notifications', { p_now: now })) ?? [],
    ),

  finish: async (id, outcome, at) => {
    unwrap(
      await admin.rpc('finish_notification', {
        p_id: id,
        p_result: outcome.result,
        p_error: outcome.error,
        p_provider_ref: outcome.providerRef,
        p_at: at,
      }),
    );
  },

  claimFallback: async (id, now) =>
    toDelivery(
      unwrap(await admin.rpc('claim_fallback', { p_id: id, p_now: now })),
    ),

  acknowledge: async ({ eventId, userId }, by, at) =>
    deliveries.parse(
      unwrap(
        await admin.rpc('acknowledge_event', {
          p_event_id: eventId,
          p_user_id: userId,
          p_by: by,
          p_at: at,
        }),
      ) ?? [],
    ),

  ackTargetsForPhone: async (phone, now) =>
    (
      unwrap(
        await admin.rpc('ack_target_for_phone', { p_phone: phone, p_now: now }),
      ) ?? []
    ).map((row) => ({ eventId: row.event_id, userId: row.user_id })),

  notificationOwner: async (id) => {
    const [row] =
      unwrap(await admin.rpc('notification_owner', { p_id: id })) ?? [];
    if (!row) return null;
    return {
      eventId: row.event_id,
      userId: row.user_id,
      providerRef: row.provider_ref,
      target: row.target,
    };
  },

  slackEventOwner: async (eventId, teamId, slackUserId) =>
    unwrap(
      await admin.rpc('slack_event_owner', {
        p_event_id: eventId,
        p_team_id: teamId,
        p_slack_user_id: slackUserId,
      }),
    ) ?? null,

  saveChannelSecret: async ({ userId, kinds, value, hint, slackTeamId }) => {
    unwrap(
      await admin.rpc('save_channel_secret', {
        p_user_id: userId,
        p_kinds: kinds,
        p_value: value,
        p_hint: hint,
        ...(slackTeamId && { p_slack_team_id: slackTeamId }),
      }),
    );
  },

  setChannelActive: async (userId, kind, active) =>
    Boolean(
      unwrap(
        await admin.rpc('set_channel_active', {
          p_user_id: userId,
          p_kind: kind,
          p_active: active,
        }),
      ),
    ),

  channelTarget: async (userId, kind) => {
    const raw = unwrap(
      await admin.rpc('channel_target', { p_user_id: userId, p_kind: kind }),
    );
    if (raw === null || raw === undefined) return null;
    return channelTargetSchema.parse(raw);
  },

  saveSlackInstall: async (install, botTokenEncrypted, userId) => {
    unwrap(
      await admin.rpc('save_slack_install', {
        p_team_id: install.teamId,
        p_team_name: install.teamName,
        p_bot_user_id: install.botUserId,
        p_bot_token_encrypted: botTokenEncrypted,
        p_installed_by: userId,
      }),
    );
  },

  setCalendarQuiet: async (userId, calendarId, quiet) =>
    Boolean(
      unwrap(
        await admin.rpc('set_calendar_quiet', {
          p_user_id: userId,
          p_calendar_id: calendarId,
          p_quiet: quiet,
        }),
      ),
    ),

  recordJobRun: async ({ job, ok, detail, at }) => {
    unwrap(
      await admin.rpc('record_job_run', {
        p_job: job,
        p_ok: ok,
        p_detail: detail,
        p_at: at,
      }),
    );
  },

  recordChannelTest: async ({ userId, kind, ok, error, at }) => {
    unwrap(
      await admin.rpc('record_channel_test', {
        p_user_id: userId,
        p_kind: kind,
        p_ok: ok,
        p_error: error,
        p_at: at,
      }),
    );
  },
});
