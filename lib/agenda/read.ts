import type { SupabaseClient } from '@supabase/supabase-js';
import { nextAgendaVisit } from '@/lib/agenda/changes';
import { loadSharedWithMe } from '@/lib/calendars/sharing';
import type { AgendaRows, AgendaVisit, TimeRange } from '@/types/agenda';
import type { Database } from '@/types/supabase';

export type AgendaReader = SupabaseClient<Database, 'bell'>;

export const AGENDA_EVENT_COLUMNS =
  'id, calendar_id, title, starts_at, ends_at, source_tz, raw_start, all_day, status, organizer, location, join_url, changed_at, previous_starts_at';

export const AGENDA_CALENDAR_COLUMNS = 'id, label, color';

const loadOwnCalendars = async (client: AgendaReader, userId: string) => {
  const { data, error } = await client
    .from('calendars')
    .select(AGENDA_CALENDAR_COLUMNS)
    .eq('user_id', userId)
    .eq('active', true)
    .eq('paused', false)
    .order('label');
  if (error) throw error;
  return data;
};

export const loadAgendaCalendars = async (
  client: AgendaReader,
  userId: string,
): Promise<AgendaRows['calendars']> => {
  const [own, shared] = await Promise.all([
    loadOwnCalendars(client, userId),
    loadSharedWithMe(client),
  ]);
  return [
    ...own.map((calendar) => ({ ...calendar, shared: false })),
    ...shared.map((calendar) => ({ ...calendar, shared: true })),
  ];
};

export const loadAgendaRows = async (
  client: AgendaReader,
  userId: string,
  range: TimeRange,
): Promise<AgendaRows> => {
  const calendars = await loadAgendaCalendars(client, userId);
  if (!calendars.length) return { calendars, events: [] };
  const { data, error } = await client
    .from('events')
    .select(AGENDA_EVENT_COLUMNS)
    .in(
      'calendar_id',
      calendars.map((calendar) => calendar.id),
    )
    .lt('starts_at', range.to)
    .gt('ends_at', range.from)
    .order('starts_at');
  if (error) throw error;
  return { calendars, events: data };
};

export const recordAgendaVisit = async (
  client: AgendaReader,
  userId: string,
  now: Date,
): Promise<AgendaVisit> => {
  const previous = await client
    .from('agenda_visits')
    .select('seen_at, baseline_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (previous.error) throw previous.error;
  const visit = nextAgendaVisit(previous.data, now);
  const { error } = await client
    .from('agenda_visits')
    .upsert({ user_id: userId, ...visit }, { onConflict: 'user_id' });
  if (error) throw error;
  return visit;
};
