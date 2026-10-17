import type {
  AgendaCalendarRow,
  AgendaEventRow,
  AgendaRows,
} from '@/types/agenda';

export const AGENDA_NOW = new Date('2026-10-10T15:00:00.000Z');

export const PERSONAL: AgendaCalendarRow = {
  id: 'cal-personal',
  label: 'Personal',
  color: '#4285f4',
};

export const CLIENT: AgendaCalendarRow = {
  id: 'cal-client',
  label: 'Client',
  color: '#e8a33d',
};

export const agendaEvent = (
  overrides: Partial<AgendaEventRow> = {},
): AgendaEventRow => ({
  id: 'evt-1',
  calendar_id: PERSONAL.id,
  title: 'Standup',
  starts_at: '2026-10-10T17:00:00.000Z',
  ends_at: '2026-10-10T17:30:00.000Z',
  source_tz: 'America/Chicago',
  raw_start: '2026-10-10T12:00:00-05:00',
  all_day: false,
  status: 'confirmed',
  organizer: 'boss@client.com',
  location: null,
  join_url: null,
  changed_at: null,
  previous_starts_at: null,
  ...overrides,
});

export const agendaRows = (
  events: AgendaEventRow[],
  calendars: AgendaCalendarRow[] = [PERSONAL, CLIENT],
): AgendaRows => ({ events, calendars });
