import { isSameMeeting, mergeDuplicates } from '@/lib/agenda/dedup';
import { CLIENT, PERSONAL, agendaEvent } from '@/test-utils/agendaFakes';

const onClient = (overrides = {}) =>
  agendaEvent({ id: 'evt-2', calendar_id: CLIENT.id, ...overrides });

describe('isSameMeeting', () => {
  it('matches the same title within five minutes on another calendar', () => {
    expect(
      isSameMeeting(
        agendaEvent({ title: 'Weekly  Sync ', organizer: null }),
        onClient({
          title: 'weekly sync',
          organizer: null,
          starts_at: '2026-10-10T17:05:00.000Z',
        }),
      ),
    ).toBe(true);
  });

  it('does not match the same title six minutes apart', () => {
    expect(
      isSameMeeting(
        agendaEvent({ organizer: null }),
        onClient({ organizer: null, starts_at: '2026-10-10T17:06:00.000Z' }),
      ),
    ).toBe(false);
  });

  it('matches the same organizer and start even when the titles differ', () => {
    expect(
      isSameMeeting(
        agendaEvent({ title: 'Standup' }),
        onClient({ title: 'Team standup', organizer: 'Boss@Client.com' }),
      ),
    ).toBe(true);
    expect(
      isSameMeeting(
        agendaEvent({ title: 'Standup' }),
        onClient({
          title: 'Team standup',
          starts_at: '2026-10-10T17:01:00.000Z',
        }),
      ),
    ).toBe(false);
  });

  it('never merges two events of the same calendar', () => {
    expect(isSameMeeting(agendaEvent(), agendaEvent({ id: 'evt-2' }))).toBe(
      false,
    );
  });

  it('keeps a cancelled copy apart from a live one, and all-day apart from timed', () => {
    expect(
      isSameMeeting(agendaEvent(), onClient({ status: 'cancelled' })),
    ).toBe(false);
    expect(isSameMeeting(agendaEvent(), onClient({ all_day: true }))).toBe(
      false,
    );
  });

  it('does not treat two untitled, organizer-less events as one', () => {
    expect(
      isSameMeeting(
        agendaEvent({ title: '', organizer: null }),
        onClient({ title: '', organizer: null }),
      ),
    ).toBe(false);
  });
});

describe('mergeDuplicates', () => {
  it('shows one meeting carried by two calendars as one group with both calendars', () => {
    const groups = mergeDuplicates([
      onClient({ starts_at: '2026-10-10T17:02:00.000Z' }),
      agendaEvent(),
      agendaEvent({
        id: 'evt-3',
        title: 'Lunch',
        organizer: null,
        starts_at: '2026-10-10T18:00:00.000Z',
        ends_at: '2026-10-10T19:00:00.000Z',
      }),
    ]);

    expect(groups.map((group) => [group.key, group.calendarIds])).toEqual([
      ['evt-1', [PERSONAL.id, CLIENT.id]],
      ['evt-3', [PERSONAL.id]],
    ]);
    expect(groups[0].members.map((member) => member.id)).toEqual([
      'evt-1',
      'evt-2',
    ]);
  });

  it('puts a third calendar copy in the same group but not two copies from one calendar', () => {
    const groups = mergeDuplicates([
      agendaEvent(),
      onClient(),
      agendaEvent({ id: 'evt-3', calendar_id: 'cal-third' }),
      agendaEvent({ id: 'evt-4' }),
    ]);

    expect(groups.map((group) => group.members.length)).toEqual([3, 1]);
  });

  it('does not mutate its input', () => {
    const input = [onClient(), agendaEvent()];
    mergeDuplicates(input);

    expect(input.map((event) => event.id)).toEqual(['evt-2', 'evt-1']);
  });
});
