import type { AgendaRows } from '@/types/agenda';

export const sharedCalendarKey = (rows: AgendaRows): string =>
  rows.calendars
    .filter((calendar) => calendar.shared)
    .map((calendar) => calendar.id)
    .sort()
    .join(',');
