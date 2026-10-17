import { buildAgenda } from '@/lib/agenda/build';
import { zoneFlagText } from '@/lib/agenda/card';
import {
  AGENDA_NOW,
  CLIENT,
  PERSONAL,
  TEAM,
  agendaEvent,
  agendaRows,
} from '@/test-utils/agendaFakes';
import type { AgendaEventRow } from '@/types/agenda';

const CT = 'America/Chicago';

const build = (events: AgendaEventRow[], baselineAt: string | null = null) =>
  buildAgenda({
    rows: agendaRows(events),
    timeZone: CT,
    now: AGENDA_NOW,
    baselineAt,
  });

const today = (events: AgendaEventRow[]) => build(events).days[0];

describe('buildAgenda', () => {
  it('lays out today and the next seven days in the user time zone', () => {
    const view = build([
      agendaEvent(),
      agendaEvent({
        id: 'late',
        title: 'Late call',
        starts_at: '2026-10-11T03:00:00.000Z',
        ends_at: '2026-10-11T03:30:00.000Z',
      }),
    ]);

    expect(view.days.map((day) => day.label)).toEqual([
      'Today',
      'Tomorrow',
      'Mon, Oct 12',
      'Tue, Oct 13',
      'Wed, Oct 14',
      'Thu, Oct 15',
      'Fri, Oct 16',
      'Sat, Oct 17',
    ]);
    expect(view.days[0].cards.map((card) => card.title)).toEqual([
      'Standup',
      'Late call',
    ]);
    expect(view.days[0].cards[1].timeLabel).toBe('10:00 PM – 10:30 PM CT');
    expect(view.days[1].hasNoEvents).toBe(true);
    expect(view.isEmpty).toBe(false);
  });

  it('shows a meeting on two calendars once, with both badges', () => {
    const [card] = today([
      agendaEvent(),
      agendaEvent({ id: 'evt-2', calendar_id: CLIENT.id }),
    ]).cards;

    expect(card.badges).toEqual([
      {
        key: PERSONAL.id,
        label: 'Personal',
        color: PERSONAL.color,
        shared: false,
      },
      { key: CLIENT.id, label: 'Client', color: CLIENT.color, shared: false },
    ]);
    expect(card.accentColor).toBe(PERSONAL.color);
  });

  it('badges a shared calendar’s meeting with the sharer’s label, marked shared', () => {
    const view = buildAgenda({
      rows: agendaRows(
        [agendaEvent({ id: 'team-1', calendar_id: TEAM.id })],
        [PERSONAL, TEAM],
      ),
      timeZone: CT,
      now: AGENDA_NOW,
      baselineAt: null,
    });

    expect(view.days[0].cards[0].badges).toEqual([
      { key: TEAM.id, label: 'Team standups', color: TEAM.color, shared: true },
    ]);
  });

  it('flags an invite whose time zone is not the user’s and shows both times', () => {
    const [card] = today([
      agendaEvent({
        source_tz: 'America/New_York',
        raw_start: '2026-10-10T13:00:00-04:00',
      }),
    ]).cards;

    expect(card.showZoneFlag).toBe(true);
    expect(card.zoneFlag).toBe('12:00 PM CT · invite says 1:00 PM ET');
    expect(card.timeLabel).toBe('12:00 PM – 12:30 PM CT');
  });

  it('flags the merged card when only one copy carries the other zone', () => {
    const [card] = today([
      agendaEvent(),
      agendaEvent({
        id: 'evt-2',
        calendar_id: CLIENT.id,
        source_tz: 'America/New_York',
      }),
    ]).cards;

    expect(card.zoneFlag).toBe('12:00 PM CT · invite says 1:00 PM ET');
  });

  it('names the invite’s weekday when its date differs', () => {
    expect(zoneFlagText('2026-10-11T02:00:00.000Z', CT, 'Asia/Tokyo')).toBe(
      '9:00 PM CT · invite says Sun 11:00 AM GMT+9',
    );
  });

  it('does not flag an event in the user’s own zone or an all-day event', () => {
    const cards = today([
      agendaEvent(),
      agendaEvent({
        id: 'holiday',
        title: 'Holiday',
        all_day: true,
        source_tz: 'Asia/Tokyo',
        raw_start: '2026-10-10',
        starts_at: '2026-10-09T15:00:00.000Z',
        ends_at: '2026-10-10T15:00:00.000Z',
      }),
    ]).cards;

    expect(
      cards.map((card) => [card.title, card.timeLabel, card.showZoneFlag]),
    ).toEqual([
      ['Holiday', 'All day', false],
      ['Standup', '12:00 PM – 12:30 PM CT', false],
    ]);
  });

  it('spreads a multi-day all-day event across its days', () => {
    const view = build([
      agendaEvent({
        id: 'trip',
        title: 'Trip',
        all_day: true,
        raw_start: '2026-10-12',
        starts_at: '2026-10-12T05:00:00.000Z',
        ends_at: '2026-10-15T05:00:00.000Z',
      }),
    ]);

    expect(view.days.map((day) => day.cards.length)).toEqual([
      0, 0, 1, 1, 1, 0, 0, 0,
    ]);
  });

  it('pins the next event and marks now', () => {
    const view = build([
      agendaEvent({
        id: 'past',
        title: 'Breakfast',
        organizer: null,
        starts_at: '2026-10-10T13:00:00.000Z',
        ends_at: '2026-10-10T14:00:00.000Z',
      }),
      agendaEvent({
        id: 'ongoing',
        title: 'Focus',
        organizer: null,
        starts_at: '2026-10-10T14:30:00.000Z',
        ends_at: '2026-10-10T15:30:00.000Z',
      }),
      agendaEvent(),
    ]);
    const [breakfast, focus, standup] = view.days[0].cards;

    expect(view.next?.card.title).toBe('Standup');
    expect(view.next?.startsAt).toBe('2026-10-10T17:00:00.000Z');
    expect(breakfast.isPast).toBe(true);
    expect(focus.isNow).toBe(true);
    expect(standup.showNowLineBefore).toBe(true);
    expect([breakfast.showNowLineBefore, focus.showNowLineBefore]).toEqual([
      false,
      false,
    ]);
    expect(view.days[0].showNowLineAtEnd).toBe(false);
  });

  it('puts the now line at the end once today is over', () => {
    const day = today([
      agendaEvent({
        starts_at: '2026-10-10T13:00:00.000Z',
        ends_at: '2026-10-10T14:00:00.000Z',
      }),
    ]);

    expect(day.showNowLineAtEnd).toBe(true);
    expect(build([]).next).toBeNull();
  });

  it('keeps an event that started yesterday and is still going on today', () => {
    const [card] = today([
      agendaEvent({
        title: 'Overnight deploy',
        starts_at: '2026-10-10T03:00:00.000Z',
        ends_at: '2026-10-10T16:00:00.000Z',
      }),
    ]).cards;

    expect(card.isNow).toBe(true);
  });

  it('strikes a cancelled event, shows a moved event’s old time and dots a new one', () => {
    const cards = today([
      agendaEvent({
        id: 'gone',
        title: 'Gone',
        organizer: null,
        status: 'cancelled',
        changed_at: '2026-10-10T14:00:00.000Z',
      }),
      agendaEvent({
        id: 'moved',
        title: 'Moved',
        organizer: null,
        starts_at: '2026-10-10T19:00:00.000Z',
        ends_at: '2026-10-10T19:30:00.000Z',
        previous_starts_at: '2026-10-09T19:00:00.000Z',
        changed_at: '2026-10-10T14:00:00.000Z',
      }),
      agendaEvent({
        id: 'new',
        title: 'New',
        organizer: null,
        starts_at: '2026-10-10T20:00:00.000Z',
        ends_at: '2026-10-10T20:30:00.000Z',
        changed_at: '2026-10-10T14:00:00.000Z',
      }),
    ]).cards;

    expect(
      cards.map((card) => [card.title, card.markerLabel, card.isCancelled]),
    ).toEqual([
      ['Gone', 'Cancelled', true],
      ['Moved', 'Moved', false],
      ['New', 'New', false],
    ]);
    expect(cards[1].previousTime).toBe('Was Fri 2:00 PM');
    expect(cards[0].showJoin).toBe(false);
  });

  it('drops old cancellations and changes the user already saw', () => {
    const view = build(
      [
        agendaEvent({
          id: 'gone',
          status: 'cancelled',
          changed_at: '2026-10-08T14:00:00.000Z',
        }),
        agendaEvent({ id: 'seen', changed_at: '2026-10-10T09:00:00.000Z' }),
      ],
      '2026-10-10T10:00:00.000Z',
    );

    expect(
      view.days[0].cards.map((card) => [card.key, card.showMarker]),
    ).toEqual([['seen', false]]);
  });

  it('leaves out events of calendars that are not shown', () => {
    const view = buildAgenda({
      rows: agendaRows([agendaEvent({ calendar_id: 'cal-paused' })]),
      timeZone: CT,
      now: AGENDA_NOW,
      baselineAt: null,
    });

    expect(view.isEmpty).toBe(true);
  });
});
