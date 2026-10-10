import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';
import { SHARE_ERRORS } from '@/lib/constants';
import { ApiError } from '@/lib/errors';
import {
  myShareRows,
  shareOutcome,
  sharedWithMeRows,
} from '@/lib/schemas/calendars';
import type { ShareOutcome } from '@/lib/schemas/calendars';
import type {
  CalendarRow,
  OwnedShareView,
  SharedCalendarView,
  SharingView,
} from '@/types/calendar';
import type { Database } from '@/types/supabase';

type BellRpcClient = SupabaseClient<Database, 'bell'>;

type ShareRow = z.infer<typeof myShareRows>[number];
type SharedWithMeRow = z.infer<typeof sharedWithMeRows>[number];
type OwnedCalendar = Pick<CalendarRow, 'id' | 'label' | 'color'>;

type RpcResult<Data> = { data: Data; error: null } | { error: Error };

const unwrap = <Data>(result: RpcResult<Data>): Data => {
  if (result.error) throw result.error;
  return result.data;
};

export interface ShareRepo {
  share: (
    userId: string,
    calendarId: string,
    email: string,
  ) => Promise<ShareOutcome>;
  unshare: (
    userId: string,
    calendarId: string,
    sharedWithUserId: string,
  ) => Promise<boolean>;
}

export const createShareRepo = (admin: BellRpcClient): ShareRepo => ({
  share: async (userId, calendarId, email) =>
    shareOutcome.parse(
      unwrap(
        await admin.rpc('share_calendar', {
          p_user_id: userId,
          p_calendar_id: calendarId,
          p_email: email,
        }),
      ),
    ),

  unshare: async (userId, calendarId, sharedWithUserId) =>
    Boolean(
      unwrap(
        await admin.rpc('unshare_calendar', {
          p_user_id: userId,
          p_calendar_id: calendarId,
          p_shared_with: sharedWithUserId,
        }),
      ),
    ),
});

export const shareCalendar = async (
  repo: ShareRepo,
  userId: string,
  calendarId: string,
  email: string,
): Promise<void> => {
  const outcome = await repo.share(userId, calendarId, email);
  if (outcome === 'shared') return;
  const failure = SHARE_ERRORS[outcome];
  throw new ApiError(failure.message, failure.status);
};

export const removeShare = async (
  repo: ShareRepo,
  userId: string,
  calendarId: string,
  sharedWithUserId: string,
): Promise<void> => {
  if (await repo.unshare(userId, calendarId, sharedWithUserId)) return;
  throw new ApiError(SHARE_ERRORS.missing.message, SHARE_ERRORS.missing.status);
};

const toSharedCalendar = (row: SharedWithMeRow): SharedCalendarView => ({
  calendarId: row.id,
  label: row.label,
  color: row.color,
});

export const buildSharingView = (
  userId: string,
  calendars: OwnedCalendar[],
  shares: ShareRow[],
  sharedWithMe: SharedWithMeRow[],
): SharingView => ({
  userId,
  owned: calendars.map((calendar): OwnedShareView => ({
    calendarId: calendar.id,
    label: calendar.label,
    color: calendar.color,
    recipients: shares
      .filter((share) => share.calendar_id === calendar.id)
      .map((share) => ({
        userId: share.shared_with_user_id,
        email: share.email,
      })),
  })),
  sharedWithMe: sharedWithMe.map(toSharedCalendar),
});

export const loadSharedWithMe = async (
  client: BellRpcClient,
): Promise<SharedWithMeRow[]> =>
  sharedWithMeRows.parse(unwrap(await client.rpc('shared_with_me')) ?? []);

export const loadSharingView = async (
  client: BellRpcClient,
  userId: string,
): Promise<SharingView> => {
  const [calendars, shares, sharedWithMe] = await Promise.all([
    client
      .from('calendars')
      .select('id, label, color')
      .eq('user_id', userId)
      .eq('active', true)
      .order('label'),
    client.rpc('my_shares'),
    loadSharedWithMe(client),
  ]);
  return buildSharingView(
    userId,
    unwrap(calendars),
    myShareRows.parse(unwrap(shares) ?? []),
    sharedWithMe,
  );
};
