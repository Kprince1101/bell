import { buildAgenda } from '@/lib/agenda/build';
import { formatCountdown } from '@/lib/agenda/format';
import { useAgendaRows } from '@/hooks/useAgendaRows';
import { useNow } from '@/hooks/useNow';
import type { AgendaClientProps, NextEventView } from '@/types/agenda';

export const AGENDA_REFRESH_FAILED =
  'Live updates hit a problem. Showing the last agenda Bell loaded.';

const resolveLiveLabel = (isLive: boolean): string => {
  if (isLive) return 'Live';
  return 'Connecting...';
};

const countdownTo = (next: NextEventView | null, now: Date): string => {
  if (!next) return '';
  return formatCountdown(Date.parse(next.startsAt) - now.getTime());
};

export const useAgendaClient = ({
  userId,
  timeZone,
  baselineAt,
  initialNow,
  initialRows,
}: AgendaClientProps) => {
  const now = useNow(initialNow);
  const { rows, isLive, refreshFailed } = useAgendaRows({
    userId,
    timeZone,
    initialRows,
  });
  const view = buildAgenda({ rows, timeZone, now, baselineAt });

  return {
    days: view.days,
    nextCard: view.next?.card ?? null,
    countdown: countdownTo(view.next, now),
    isEmpty: view.isEmpty,
    showDays: !view.isEmpty,
    timeZone,
    isLive,
    liveLabel: resolveLiveLabel(isLive),
    showRefreshFailed: refreshFailed,
    refreshFailedMessage: AGENDA_REFRESH_FAILED,
  };
};
