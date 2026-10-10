import { NOTIFY_ERROR_MESSAGES, NOTIFY_NOTICE_MESSAGES } from '@/lib/constants';
import { formatEventTime } from '@/lib/notify/messages';
import { CHANNEL_KINDS } from '@/lib/schemas/notifications';
import type { BellClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';
import type {
  ChannelView,
  QuietCalendarView,
  RingingEventView,
} from '@/types/notifications';

type Tables = Database['bell']['Tables'];
type ChannelRow = Pick<Tables['channels']['Row'], 'kind' | 'active' | 'hint'>;
type NotificationRow = Pick<
  Tables['notifications']['Row'],
  'event_id' | 'sent_at'
>;
type EventRow = Pick<
  Tables['events']['Row'],
  'id' | 'title' | 'starts_at' | 'join_url' | 'source_tz' | 'status'
>;

export const RINGING_LOOKBACK_MS = 15 * 60 * 1000;

export interface NotificationsSearchParams {
  error?: string;
  notice?: string;
}

export interface NotificationsView {
  channels: ChannelView[];
  calendars: QuietCalendarView[];
  ringing: RingingEventView[];
}

export const buildChannelViews = (rows: ChannelRow[]): ChannelView[] =>
  CHANNEL_KINDS.map((kind) => {
    const row = rows.find((candidate) => candidate.kind === kind);
    return {
      kind,
      configured: Boolean(row),
      active: row?.active ?? false,
      hint: row?.hint ?? null,
    };
  });

const ringingStatus = (sent: boolean): string => {
  if (sent) return 'Ringing';
  return 'Coming up';
};

export const buildRingingViews = (
  notifications: NotificationRow[],
  events: EventRow[],
  timeZone: string,
): RingingEventView[] =>
  events
    .filter((event) => event.status !== 'cancelled')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((event) => ({
      eventId: event.id,
      title: event.title.trim() || '(no title)',
      when: formatEventTime(event.starts_at, timeZone, event.source_tz),
      joinUrl: event.join_url,
      status: ringingStatus(
        notifications.some(
          (row) => row.event_id === event.id && Boolean(row.sent_at),
        ),
      ),
    }));

const loadRinging = async (
  supabase: BellClient,
  timeZone: string,
  now: Date,
): Promise<RingingEventView[]> => {
  const notifications = await supabase
    .from('notifications')
    .select('event_id, sent_at')
    .is('acknowledged_at', null)
    .gte(
      'event_starts_at',
      new Date(now.getTime() - RINGING_LOOKBACK_MS).toISOString(),
    );
  if (notifications.error) throw notifications.error;
  const eventIds = [...new Set(notifications.data.map((row) => row.event_id))];
  if (!eventIds.length) return [];
  const events = await supabase
    .from('events')
    .select('id, title, starts_at, join_url, source_tz, status')
    .in('id', eventIds);
  if (events.error) throw events.error;
  return buildRingingViews(notifications.data, events.data, timeZone);
};

export const loadNotificationsView = async (
  supabase: BellClient,
  timeZone: string,
  now: Date,
): Promise<NotificationsView> => {
  const [channels, calendars, ringing] = await Promise.all([
    supabase.from('channels').select('kind, active, hint'),
    supabase
      .from('calendars')
      .select('id, label, color, quiet')
      .eq('active', true)
      .order('label'),
    loadRinging(supabase, timeZone, now),
  ]);
  if (channels.error) throw channels.error;
  if (calendars.error) throw calendars.error;
  return {
    channels: buildChannelViews(channels.data),
    calendars: calendars.data,
    ringing,
  };
};

export const resolveNotifyMessages = ({
  error,
  notice,
}: NotificationsSearchParams) => ({
  error: NOTIFY_ERROR_MESSAGES[error ?? ''] ?? null,
  notice: NOTIFY_NOTICE_MESSAGES[notice ?? ''] ?? null,
});
