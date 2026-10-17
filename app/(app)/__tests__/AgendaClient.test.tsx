import { act, render, screen, within } from '@testing-library/react';
import { AgendaClient } from '@/app/(app)/AgendaClient';
import { createClient } from '@/lib/supabase/client';
import {
  AGENDA_NOW,
  CLIENT,
  agendaEvent,
  agendaRows,
} from '@/test-utils/agendaFakes';
import { createRealtimeFake } from '@/test-utils/realtimeFake';
import { USER_ID } from '@/test-utils/supabaseFake';
import type { AgendaClientProps } from '@/types/agenda';

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));

const PROPS: AgendaClientProps = {
  userId: USER_ID,
  timeZone: 'America/Chicago',
  baselineAt: null,
  initialNow: AGENDA_NOW.toISOString(),
  initialRows: agendaRows([
    agendaEvent(),
    agendaEvent({ id: 'evt-2', calendar_id: CLIENT.id }),
    agendaEvent({
      id: 'review',
      title: 'Client review',
      organizer: 'pm@client.com',
      calendar_id: CLIENT.id,
      source_tz: 'America/New_York',
      starts_at: '2026-10-12T17:00:00.000Z',
      ends_at: '2026-10-12T18:00:00.000Z',
    }),
    agendaEvent({
      id: 'gone',
      title: 'Retro',
      organizer: null,
      status: 'cancelled',
      changed_at: '2026-10-10T14:00:00.000Z',
      starts_at: '2026-10-10T20:00:00.000Z',
      ends_at: '2026-10-10T21:00:00.000Z',
    }),
  ]),
};

describe('AgendaClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AGENDA_NOW);
    vi.mocked(createClient).mockReturnValue(
      createRealtimeFake().client as unknown as ReturnType<typeof createClient>,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pins the next event with a ticking countdown', () => {
    render(<AgendaClient {...PROPS} />);
    const next = screen.getByRole('region', { name: 'Next event' });

    expect(within(next).getByRole('timer')).toHaveTextContent('in 2h 00m 00s');
    act(() => vi.advanceTimersByTime(1000));
    expect(within(next).getByRole('timer')).toHaveTextContent('in 1h 59m 59s');
  });

  it('shows a meeting on two calendars once with both badges', () => {
    render(<AgendaClient {...PROPS} />);
    const todayList = screen.getByRole('region', { name: 'Today' });
    const standups = within(todayList).getAllByRole('article', {
      name: 'Standup',
    });

    expect(standups).toHaveLength(1);
    expect(
      within(standups[0]).getByRole('list', { name: 'Calendars' }),
    ).toHaveTextContent('PersonalClient');
  });

  it('shows both times and a visible flag for an invite in another zone', () => {
    render(<AgendaClient {...PROPS} />);
    const review = screen.getByRole('article', { name: 'Client review' });

    expect(within(review).getByRole('note')).toHaveTextContent(
      '12:00 PM CT · invite says 1:00 PM ET',
    );
  });

  it('strikes through a cancellation with a marker and draws the now line', () => {
    render(<AgendaClient {...PROPS} />);
    const retro = screen.getByRole('article', { name: 'Retro' });

    expect(within(retro).getByText('Cancelled')).toBeInTheDocument();
    expect(within(retro).getByRole('heading', { name: 'Retro' })).toHaveClass(
      'line-through',
    );
    expect(screen.getByRole('separator', { name: 'Now' })).toBeInTheDocument();
  });

  it('says the agenda is empty when nothing is scheduled', () => {
    render(<AgendaClient {...PROPS} initialRows={agendaRows([])} />);

    expect(screen.getByText('Your agenda is empty')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Next event' })).toBeNull();
  });
});
