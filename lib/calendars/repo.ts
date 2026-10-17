import type { AdminClient } from '@/lib/account';
import { channelHealthAfterRenewal } from '@/lib/calendars/health';
import type { CalendarRepo } from '@/lib/calendars/services';
import {
  decryptToken,
  encryptToken,
  readTokenKey,
} from '@/lib/crypto/tokenCipher';
import type { DiscoveredCalendar } from '@/types/calendar';
import type { Database, Json } from '@/types/supabase';

type CalendarInsert = Database['bell']['Tables']['calendars']['Insert'];

type QueryResult<Data> = { data: Data; error: null } | { error: Error };

const unwrap = <Data>(result: QueryResult<Data>): Data => {
  if (result.error) throw result.error;
  return result.data;
};

const calendarInsert = (
  userId: string,
  accountId: string,
  calendar: DiscoveredCalendar,
): CalendarInsert => {
  const row: CalendarInsert = {
    user_id: userId,
    account_id: accountId,
    google_calendar_id: calendar.googleCalendarId,
    label: calendar.label,
    time_zone: calendar.timeZone,
  };
  if (calendar.color) row.color = calendar.color;
  return row;
};

export const createCalendarRepo = (
  admin: AdminClient,
  tokenKey: () => Buffer = () => readTokenKey(),
): CalendarRepo => {
  const encrypt = (token: string) => encryptToken(token, tokenKey());

  return {
    accountsForUser: async (userId) =>
      unwrap(
        await admin
          .from('accounts')
          .select('*')
          .eq('user_id', userId)
          .order('created_at'),
      ),

    accountForUser: async (userId, accountId) =>
      unwrap(
        await admin
          .from('accounts')
          .select('*')
          .eq('user_id', userId)
          .eq('id', accountId)
          .maybeSingle(),
      ),

    saveAccount: async ({ userId, googleAccountId, email, refreshToken }) => {
      const account = unwrap(
        await admin
          .from('accounts')
          .upsert(
            { user_id: userId, google_account_id: googleAccountId, email },
            { onConflict: 'user_id,google_account_id' },
          )
          .select('*')
          .single(),
      );
      unwrap(
        await admin.from('account_secrets').upsert(
          {
            account_id: account.id,
            refresh_token_encrypted: encrypt(refreshToken),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'account_id' },
        ),
      );
      return account;
    },

    refreshToken: async (accountId) => {
      const secret = unwrap(
        await admin
          .from('account_secrets')
          .select('refresh_token_encrypted')
          .eq('account_id', accountId)
          .single(),
      );
      return decryptToken(secret.refresh_token_encrypted, tokenKey());
    },

    saveRefreshToken: async (accountId, refreshToken) => {
      unwrap(
        await admin
          .from('account_secrets')
          .update({
            refresh_token_encrypted: encrypt(refreshToken),
            updated_at: new Date().toISOString(),
          })
          .eq('account_id', accountId),
      );
    },

    deleteAccount: async (accountId) => {
      unwrap(await admin.from('accounts').delete().eq('id', accountId));
    },

    saveDiscoveredCalendars: async (account, calendars) => {
      if (!calendars.length) return;
      unwrap(
        await admin.from('calendars').upsert(
          calendars.map((calendar) =>
            calendarInsert(account.user_id, account.id, calendar),
          ),
          {
            onConflict: 'account_id,google_calendar_id',
            ignoreDuplicates: true,
            defaultToNull: false,
          },
        ),
      );
    },

    calendarsForUser: async (userId) =>
      unwrap(
        await admin
          .from('calendars')
          .select('*')
          .eq('user_id', userId)
          .order('created_at'),
      ),

    calendarsForAccount: async (accountId) =>
      unwrap(
        await admin.from('calendars').select('*').eq('account_id', accountId),
      ),

    calendarById: async (calendarId) =>
      unwrap(
        await admin
          .from('calendars')
          .select('*')
          .eq('id', calendarId)
          .maybeSingle(),
      ),

    calendarByChannel: async (channelId) =>
      unwrap(
        await admin
          .from('calendars')
          .select('*')
          .eq('channel_id', channelId)
          .maybeSingle(),
      ),

    calendarsDueForRenewal: async (cutoff) =>
      unwrap(
        await admin
          .from('calendars')
          .select('*')
          .eq('active', true)
          .or(`channel_expires_at.is.null,channel_expires_at.lt."${cutoff}"`),
      ),

    saveChoice: async ({ id, active, paused, label, color }) => {
      unwrap(
        await admin
          .from('calendars')
          .update({ active, paused, label, color })
          .eq('id', id),
      );
    },

    saveChannel: async (calendar, channel) => {
      unwrap(
        await admin
          .from('calendars')
          .update({
            channel_id: channel.channelId,
            channel_resource_id: channel.resourceId,
            channel_expires_at: channel.expiresAt,
            ...channelHealthAfterRenewal(calendar),
          })
          .eq('id', calendar.id),
      );
    },

    clearCalendar: async (calendarId) => {
      unwrap(
        await admin
          .from('calendars')
          .update({
            sync_token: null,
            channel_id: null,
            channel_resource_id: null,
            channel_expires_at: null,
            last_sync_at: null,
            last_error: null,
            fail_count: 0,
            healthy: true,
          })
          .eq('id', calendarId),
      );
      unwrap(await admin.from('events').delete().eq('calendar_id', calendarId));
    },

    applySync: async (calendarId, delta) =>
      unwrap(
        await admin.rpc('apply_sync', {
          p_calendar_id: calendarId,
          p_events: delta.upserts as unknown as Json,
          p_cancelled: delta.cancelled,
          p_from_sync_token: delta.fromSyncToken,
          p_sync_token: delta.nextSyncToken,
          p_full: delta.mode === 'full',
          p_window_start: delta.windowStart,
          p_window_end: delta.windowEnd,
          p_seen_at: delta.seenAt,
        }),
      ),

    recordFailure: async (calendarId, message) => {
      unwrap(
        await admin.rpc('record_sync_failure', {
          p_calendar_id: calendarId,
          p_error: message,
        }),
      );
    },

    markPushStopped: async (now) =>
      unwrap(await admin.rpc('mark_push_stopped', { p_now: now })) ?? [],
  };
};
