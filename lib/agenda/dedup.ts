import { DUPLICATE_WINDOW_MS } from '@/lib/constants';
import type { AgendaEventRow, MergedEvent } from '@/types/agenda';

type MeetingFields = Pick<
  AgendaEventRow,
  'calendar_id' | 'title' | 'starts_at' | 'all_day' | 'status' | 'organizer'
>;

const normalizeText = (value: string | null): string =>
  (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

const isCancelled = (event: Pick<AgendaEventRow, 'status'>): boolean =>
  event.status === 'cancelled';

export const isSameMeeting = (
  left: MeetingFields,
  right: MeetingFields,
): boolean => {
  if (left.calendar_id === right.calendar_id) return false;
  if (left.all_day !== right.all_day) return false;
  if (isCancelled(left) !== isCancelled(right)) return false;
  const gap = Math.abs(
    Date.parse(left.starts_at) - Date.parse(right.starts_at),
  );
  const title = normalizeText(left.title);
  if (
    title &&
    title === normalizeText(right.title) &&
    gap <= DUPLICATE_WINDOW_MS
  ) {
    return true;
  }
  const organizer = normalizeText(left.organizer);
  return (
    Boolean(organizer) &&
    organizer === normalizeText(right.organizer) &&
    gap === 0
  );
};

const byStart = (left: AgendaEventRow, right: AgendaEventRow): number =>
  Date.parse(left.starts_at) - Date.parse(right.starts_at) ||
  left.id.localeCompare(right.id);

const joins = (group: MergedEvent, event: AgendaEventRow): boolean =>
  !group.calendarIds.includes(event.calendar_id) &&
  group.members.some((member) => isSameMeeting(member, event));

export const mergeDuplicates = (events: AgendaEventRow[]): MergedEvent[] => {
  const groups: MergedEvent[] = [];
  for (const event of [...events].sort(byStart)) {
    const group = groups.find((candidate) => joins(candidate, event));
    if (group) {
      group.members.push(event);
      group.calendarIds.push(event.calendar_id);
      continue;
    }
    groups.push({
      key: event.id,
      primary: event,
      members: [event],
      calendarIds: [event.calendar_id],
    });
  }
  return groups;
};
