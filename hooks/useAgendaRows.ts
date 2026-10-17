import { useCallback, useEffect, useRef, useState } from 'react';
import { loadAgendaRows } from '@/lib/agenda/read';
import { agendaWindow } from '@/lib/agenda/window';
import { AGENDA_REFRESH_DELAY_MS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';
import type { AgendaRows } from '@/types/agenda';

interface UseAgendaRowsInput {
  userId: string;
  timeZone: string;
  initialRows: AgendaRows;
}

export const useAgendaRows = ({
  userId,
  timeZone,
  initialRows,
}: UseAgendaRowsInput) => {
  const [rows, setRows] = useState(initialRows);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const range = agendaWindow(new Date(), timeZone).query;
      setRows(await loadAgendaRows(createClient(), userId, range));
      setRefreshFailed(false);
    } catch (err) {
      console.error(err);
      setRefreshFailed(true);
    }
  }, [userId, timeZone]);

  const scheduleRefresh = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void refresh(), AGENDA_REFRESH_DELAY_MS);
  }, [refresh]);

  const { isLive } = useRealtimeEvents(userId, scheduleRefresh);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearTimeout(timer.current);
    };
  }, [scheduleRefresh]);

  return { rows, isLive, refreshFailed };
};
