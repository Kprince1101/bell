import { buildCard } from '@/lib/agenda/card';
import type { CardContext } from '@/lib/agenda/card';
import { changeMarker, isShownOnAgenda } from '@/lib/agenda/changes';
import { mergeDuplicates } from '@/lib/agenda/dedup';
import { formatDayLabel } from '@/lib/agenda/format';
import { addDaysToKey, agendaWindow, localDateKey } from '@/lib/agenda/window';
import { DAY_MS } from '@/lib/constants';
import type {
  AgendaCardView,
  AgendaDayView,
  AgendaRows,
  AgendaView,
  AgendaWindow,
  MergedEvent,
  NextEventView,
} from '@/types/agenda';

export interface BuildAgendaInput {
  rows: AgendaRows;
  timeZone: string;
  now: Date;
  baselineAt: string | null;
}

interface PlacedCard {
  group: MergedEvent;
  card: AgendaCardView;
  startsAt: number;
}

const allDayKeys = (group: MergedEvent): string[] => {
  const { primary } = group;
  const first = primary.raw_start.slice(0, 10);
  const span = Math.max(
    1,
    Math.round(
      (Date.parse(primary.ends_at) - Date.parse(primary.starts_at)) / DAY_MS,
    ),
  );
  return Array.from({ length: span }, (_, index) => addDaysToKey(first, index));
};

export const dayKeysFor = (
  group: MergedEvent,
  window: AgendaWindow,
  timeZone: string,
): string[] => {
  const { primary } = group;
  if (primary.all_day) return allDayKeys(group);
  const windowStart = Date.parse(window.from);
  if (Date.parse(primary.starts_at) >= windowStart) {
    return [localDateKey(primary.starts_at, timeZone)];
  }
  if (Date.parse(primary.ends_at) > windowStart) return [window.todayKey];
  return [];
};

const byTimeOfDay = (left: PlacedCard, right: PlacedCard): number =>
  Number(right.group.primary.all_day) - Number(left.group.primary.all_day) ||
  left.startsAt - right.startsAt;

const markNow = (
  placed: PlacedCard[],
  now: number,
  isToday: boolean,
): { cards: AgendaCardView[]; showNowLineAtEnd: boolean } => {
  if (!isToday) {
    return {
      cards: placed.map((entry) => entry.card),
      showNowLineAtEnd: false,
    };
  }
  const upcoming = placed.findIndex(
    (entry) => !entry.group.primary.all_day && entry.startsAt > now,
  );
  const cards = placed.map((entry, index) => ({
    ...entry.card,
    showNowLineBefore: index === upcoming,
  }));
  return { cards, showNowLineAtEnd: upcoming === -1 && cards.length > 0 };
};

const buildDay = (
  key: string,
  placed: PlacedCard[],
  window: AgendaWindow,
  now: number,
): AgendaDayView => {
  const sorted = [...placed].sort(byTimeOfDay);
  const { cards, showNowLineAtEnd } = markNow(
    sorted,
    now,
    key === window.todayKey,
  );
  return {
    key,
    label: formatDayLabel(key, window.todayKey),
    cards,
    hasNoEvents: !cards.length,
    showNowLineAtEnd,
  };
};

const findNext = (
  placed: PlacedCard[],
  now: number,
  windowEnd: number,
): NextEventView | null => {
  const next = placed
    .filter(
      (entry) =>
        !entry.group.primary.all_day &&
        !entry.card.isCancelled &&
        entry.startsAt > now &&
        entry.startsAt < windowEnd,
    )
    .sort((left, right) => left.startsAt - right.startsAt)[0];
  if (!next) return null;
  return { card: next.card, startsAt: next.group.primary.starts_at };
};

export const buildAgenda = ({
  rows,
  timeZone,
  now,
  baselineAt,
}: BuildAgendaInput): AgendaView => {
  const window = agendaWindow(now, timeZone);
  const calendars = new Map(rows.calendars.map((row) => [row.id, row]));
  const context: CardContext = { timeZone, now, calendars };
  const visible = rows.events.filter(
    (event) =>
      calendars.has(event.calendar_id) &&
      isShownOnAgenda(event, changeMarker(event, baselineAt, now)),
  );
  const placedByDay = new Map<string, PlacedCard[]>(
    window.dayKeys.map((key) => [key, []]),
  );
  const placed = mergeDuplicates(visible).map((group) => ({
    group,
    card: buildCard(
      group,
      changeMarker(group.primary, baselineAt, now),
      context,
    ),
    startsAt: Date.parse(group.primary.starts_at),
  }));
  for (const entry of placed) {
    for (const key of dayKeysFor(entry.group, window, timeZone)) {
      placedByDay.get(key)?.push(entry);
    }
  }
  const days = window.dayKeys.map((key) =>
    buildDay(key, placedByDay.get(key) ?? [], window, now.getTime()),
  );
  return {
    days,
    next: findNext(placed, now.getTime(), Date.parse(window.to)),
    isEmpty: days.every((day) => day.hasNoEvents),
  };
};
