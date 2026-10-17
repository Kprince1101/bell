import {
  changeMarker,
  isShownOnAgenda,
  nextAgendaVisit,
} from '@/lib/agenda/changes';
import { AGENDA_NOW, agendaEvent } from '@/test-utils/agendaFakes';

const HOUR_AGO = '2026-10-10T14:00:00.000Z';
const YESTERDAY_MORNING = '2026-10-09T08:00:00.000Z';

describe('changeMarker', () => {
  it('marks nothing that never changed after its first sync', () => {
    expect(changeMarker(agendaEvent(), null, AGENDA_NOW)).toBeNull();
  });

  it('marks a new event', () => {
    expect(
      changeMarker(agendaEvent({ changed_at: HOUR_AGO }), null, AGENDA_NOW),
    ).toEqual({ kind: 'new', previousStartsAt: null });
  });

  it('marks a moved event with its old time', () => {
    expect(
      changeMarker(
        agendaEvent({
          changed_at: HOUR_AGO,
          previous_starts_at: '2026-10-10T16:00:00.000Z',
        }),
        null,
        AGENDA_NOW,
      ),
    ).toEqual({ kind: 'moved', previousStartsAt: '2026-10-10T16:00:00.000Z' });
  });

  it('treats a move back to the same instant as no move', () => {
    expect(
      changeMarker(
        agendaEvent({
          changed_at: HOUR_AGO,
          previous_starts_at: '2026-10-10T17:00:00+00:00',
        }),
        null,
        AGENDA_NOW,
      )?.kind,
    ).toBe('new');
  });

  it('marks a cancelled event', () => {
    expect(
      changeMarker(
        agendaEvent({
          status: 'cancelled',
          changed_at: HOUR_AGO,
          previous_starts_at: '2026-10-10T16:00:00.000Z',
        }),
        null,
        AGENDA_NOW,
      ),
    ).toEqual({ kind: 'cancelled', previousStartsAt: null });
  });

  it('stops marking 24 hours after the change', () => {
    const changed = agendaEvent({ changed_at: '2026-10-09T15:00:00.001Z' });

    expect(changeMarker(changed, null, AGENDA_NOW)).not.toBeNull();
    expect(
      changeMarker(changed, null, new Date('2026-10-10T15:00:00.001Z')),
    ).toBeNull();
  });

  it('only marks changes made since the user last looked', () => {
    expect(
      changeMarker(
        agendaEvent({ changed_at: YESTERDAY_MORNING }),
        '2026-10-09T09:00:00.000Z',
        AGENDA_NOW,
      ),
    ).toBeNull();
    expect(
      changeMarker(
        agendaEvent({ changed_at: HOUR_AGO }),
        '2026-10-09T09:00:00.000Z',
        AGENDA_NOW,
      ),
    ).not.toBeNull();
  });
});

describe('isShownOnAgenda', () => {
  it('shows a cancelled event only while it is marked', () => {
    const cancelled = agendaEvent({ status: 'cancelled' });

    expect(isShownOnAgenda(agendaEvent(), null)).toBe(true);
    expect(isShownOnAgenda(cancelled, null)).toBe(false);
    expect(
      isShownOnAgenda(cancelled, { kind: 'cancelled', previousStartsAt: null }),
    ).toBe(true);
  });
});

describe('nextAgendaVisit', () => {
  it('starts with no baseline on the first visit', () => {
    expect(nextAgendaVisit(null, AGENDA_NOW)).toEqual({
      seen_at: AGENDA_NOW.toISOString(),
      baseline_at: null,
    });
  });

  it('moves the baseline to the previous look after a break', () => {
    expect(
      nextAgendaVisit(
        { seen_at: YESTERDAY_MORNING, baseline_at: null },
        AGENDA_NOW,
      ),
    ).toEqual({
      seen_at: AGENDA_NOW.toISOString(),
      baseline_at: YESTERDAY_MORNING,
    });
  });

  it('keeps the baseline across reloads in the same sitting', () => {
    expect(
      nextAgendaVisit(
        { seen_at: '2026-10-10T14:50:00.000Z', baseline_at: YESTERDAY_MORNING },
        AGENDA_NOW,
      ),
    ).toEqual({
      seen_at: AGENDA_NOW.toISOString(),
      baseline_at: YESTERDAY_MORNING,
    });
  });
});
