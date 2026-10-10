import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useRequest } from '@/hooks/useRequest';
import { setCalendarQuiet } from '@/lib/notificationsApi';
import type { QuietCalendarView } from '@/types/notifications';

export interface QuietCalendarModel extends QuietCalendarView {
  disabled: boolean;
  onToggle: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export const useQuietCalendars = (calendars: QuietCalendarView[]) => {
  const request = useRequest();
  const [quiet, setQuiet] = useState<Record<string, boolean>>({});

  const handleToggle =
    (calendarId: string) => async (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.target.checked;
      const saved = await request.run(`quiet:${calendarId}`, () =>
        setCalendarQuiet(calendarId, next),
      );
      if (saved) setQuiet((current) => ({ ...current, [calendarId]: next }));
    };

  const rows: QuietCalendarModel[] = calendars.map((calendar) => ({
    ...calendar,
    quiet: quiet[calendar.id] ?? calendar.quiet,
    disabled: request.isBusy,
    onToggle: handleToggle(calendar.id),
  }));

  return {
    rows,
    hasCalendars: calendars.length > 0,
    hasNoCalendars: calendars.length === 0,
    error: request.error,
    showError: request.showError,
  };
};

export type QuietCalendarsModel = ReturnType<typeof useQuietCalendars>;
