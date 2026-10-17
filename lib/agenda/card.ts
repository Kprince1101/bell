import {
  formatClock,
  formatWeekday,
  zoneLabel,
  zonesDiffer,
} from '@/lib/agenda/format';
import { localDateKey } from '@/lib/agenda/window';
import type {
  AgendaBadge,
  AgendaCalendarRow,
  AgendaCardView,
  ChangeKind,
  ChangeMarker,
  MergedEvent,
} from '@/types/agenda';

export const CHANGE_LABELS: Record<ChangeKind, string> = {
  new: 'New',
  moved: 'Moved',
  cancelled: 'Cancelled',
};

export interface CardContext {
  timeZone: string;
  now: Date;
  calendars: Map<string, AgendaCalendarRow>;
}

const badgesFor = (
  group: MergedEvent,
  calendars: Map<string, AgendaCalendarRow>,
): AgendaBadge[] =>
  group.calendarIds.flatMap((calendarId) => {
    const calendar = calendars.get(calendarId);
    if (!calendar) return [];
    return [{ key: calendar.id, label: calendar.label, color: calendar.color }];
  });

const timeLabel = (group: MergedEvent, timeZone: string): string => {
  const { primary } = group;
  if (primary.all_day) return 'All day';
  const start = formatClock(primary.starts_at, timeZone);
  const end = formatClock(primary.ends_at, timeZone);
  return `${start} – ${end} ${zoneLabel(primary.starts_at, timeZone)}`;
};

const sourceZoneOf = (group: MergedEvent, timeZone: string): string | null => {
  if (group.primary.all_day) return null;
  return (
    group.members
      .map((member) => member.source_tz)
      .find((zone) => zonesDiffer(group.primary.starts_at, timeZone, zone)) ??
    null
  );
};

const sourceDayPrefix = (
  instant: string,
  timeZone: string,
  sourceZone: string,
): string => {
  if (localDateKey(instant, sourceZone) === localDateKey(instant, timeZone)) {
    return '';
  }
  return `${formatWeekday(instant, sourceZone)} `;
};

export const zoneFlagText = (
  instant: string,
  timeZone: string,
  sourceZone: string,
): string => {
  const mine = `${formatClock(instant, timeZone)} ${zoneLabel(instant, timeZone)}`;
  const theirs = `${sourceDayPrefix(instant, timeZone, sourceZone)}${formatClock(instant, sourceZone)} ${zoneLabel(instant, sourceZone)}`;
  return `${mine} · invite says ${theirs}`;
};

const zoneFlag = (group: MergedEvent, timeZone: string): string | null => {
  const sourceZone = sourceZoneOf(group, timeZone);
  if (!sourceZone) return null;
  return zoneFlagText(group.primary.starts_at, timeZone, sourceZone);
};

const previousTime = (
  marker: ChangeMarker | null,
  timeZone: string,
): string | null => {
  if (!marker?.previousStartsAt) return null;
  const instant = marker.previousStartsAt;
  return `Was ${formatWeekday(instant, timeZone)} ${formatClock(instant, timeZone)}`;
};

export const buildCard = (
  group: MergedEvent,
  marker: ChangeMarker | null,
  context: CardContext,
): AgendaCardView => {
  const { primary } = group;
  const now = context.now.getTime();
  const isCancelled = primary.status === 'cancelled';
  const starts = Date.parse(primary.starts_at);
  const ends = Date.parse(primary.ends_at);
  const badges = badgesFor(group, context.calendars);
  const flag = zoneFlag(group, context.timeZone);
  const was = previousTime(marker, context.timeZone);
  return {
    key: group.key,
    title: primary.title || '(No title)',
    timeLabel: timeLabel(group, context.timeZone),
    zoneFlag: flag,
    showZoneFlag: flag !== null,
    previousTime: was,
    showPreviousTime: was !== null,
    marker: marker?.kind ?? null,
    markerLabel: CHANGE_LABELS[marker?.kind ?? 'new'],
    showMarker: marker !== null,
    isCancelled,
    isNow: !isCancelled && !primary.all_day && starts <= now && now < ends,
    isPast: ends <= now,
    showNowLineBefore: false,
    accentColor: badges[0]?.color ?? '',
    badges,
    location: primary.location,
    joinUrl: primary.join_url,
    showJoin: Boolean(primary.join_url) && !isCancelled,
  };
};
