import { CHANGE_MARKER_MS, VISIT_SESSION_GAP_MS } from '@/lib/constants';
import type { AgendaEventRow, AgendaVisit, ChangeMarker } from '@/types/agenda';

type ChangeFields = Pick<
  AgendaEventRow,
  'status' | 'starts_at' | 'changed_at' | 'previous_starts_at'
>;

const wasMoved = (event: ChangeFields): boolean =>
  Boolean(event.previous_starts_at) &&
  Date.parse(event.previous_starts_at ?? '') !== Date.parse(event.starts_at);

export const changeMarker = (
  event: ChangeFields,
  baselineAt: string | null,
  now: Date,
): ChangeMarker | null => {
  if (!event.changed_at) return null;
  const changedAt = Date.parse(event.changed_at);
  if (now.getTime() - changedAt >= CHANGE_MARKER_MS) return null;
  if (baselineAt && changedAt <= Date.parse(baselineAt)) return null;
  if (event.status === 'cancelled') {
    return { kind: 'cancelled', previousStartsAt: null };
  }
  if (wasMoved(event)) {
    return { kind: 'moved', previousStartsAt: event.previous_starts_at };
  }
  return { kind: 'new', previousStartsAt: null };
};

export const isShownOnAgenda = (
  event: Pick<AgendaEventRow, 'status'>,
  marker: ChangeMarker | null,
): boolean => event.status !== 'cancelled' || marker !== null;

export const nextAgendaVisit = (
  previous: AgendaVisit | null,
  now: Date,
): AgendaVisit => {
  const seenAt = now.toISOString();
  if (!previous) return { seen_at: seenAt, baseline_at: null };
  const gap = now.getTime() - Date.parse(previous.seen_at);
  if (gap >= VISIT_SESSION_GAP_MS) {
    return { seen_at: seenAt, baseline_at: previous.seen_at };
  }
  return { seen_at: seenAt, baseline_at: previous.baseline_at };
};
