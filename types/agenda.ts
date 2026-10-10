import type { CalendarRow, EventRow } from '@/types/calendar';

export type AgendaEventRow = Pick<
  EventRow,
  | 'id'
  | 'calendar_id'
  | 'title'
  | 'starts_at'
  | 'ends_at'
  | 'source_tz'
  | 'raw_start'
  | 'all_day'
  | 'status'
  | 'organizer'
  | 'location'
  | 'join_url'
  | 'changed_at'
  | 'previous_starts_at'
>;

export interface AgendaCalendarRow extends Pick<
  CalendarRow,
  'id' | 'label' | 'color'
> {
  shared: boolean;
}

export interface AgendaRows {
  events: AgendaEventRow[];
  calendars: AgendaCalendarRow[];
}

export interface TimeRange {
  from: string;
  to: string;
}

export interface AgendaWindow extends TimeRange {
  todayKey: string;
  dayKeys: string[];
  query: TimeRange;
}

export interface MergedEvent {
  key: string;
  primary: AgendaEventRow;
  members: AgendaEventRow[];
  calendarIds: string[];
}

export type ChangeKind = 'new' | 'moved' | 'cancelled';

export interface ChangeMarker {
  kind: ChangeKind;
  previousStartsAt: string | null;
}

export interface AgendaVisit {
  seen_at: string;
  baseline_at: string | null;
}

export interface AgendaBadge {
  key: string;
  label: string;
  color: string;
  shared: boolean;
}

export interface AgendaCardView {
  key: string;
  title: string;
  timeLabel: string;
  zoneFlag: string | null;
  showZoneFlag: boolean;
  previousTime: string | null;
  showPreviousTime: boolean;
  marker: ChangeKind | null;
  markerLabel: string;
  showMarker: boolean;
  isCancelled: boolean;
  isNow: boolean;
  isPast: boolean;
  showNowLineBefore: boolean;
  accentColor: string;
  badges: AgendaBadge[];
  location: string | null;
  joinUrl: string | null;
  showJoin: boolean;
}

export interface AgendaDayView {
  key: string;
  label: string;
  cards: AgendaCardView[];
  hasNoEvents: boolean;
  showNowLineAtEnd: boolean;
}

export interface NextEventView {
  card: AgendaCardView;
  startsAt: string;
}

export interface AgendaView {
  days: AgendaDayView[];
  next: NextEventView | null;
  isEmpty: boolean;
}

export interface AgendaClientProps {
  userId: string;
  timeZone: string;
  baselineAt: string | null;
  initialNow: string;
  initialRows: AgendaRows;
}
