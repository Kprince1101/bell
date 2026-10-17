import { act, renderHook } from '@testing-library/react';
import { useAgendaClient } from '@/hooks/useAgendaClient';
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
    agendaEvent({ source_tz: 'America/New_York' }),
    agendaEvent({ id: 'evt-2', calendar_id: CLIENT.id }),
  ]),
};

describe('useAgendaClient', () => {
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

  it('pins the next event with a countdown that ticks', () => {
    const { result } = renderHook(() => useAgendaClient(PROPS));

    expect(result.current.nextCard?.title).toBe('Standup');
    expect(result.current.nextCard?.badges).toHaveLength(2);
    expect(result.current.nextCard?.zoneFlag).toBe(
      '12:00 PM CT · invite says 1:00 PM ET',
    );
    expect(result.current.countdown).toBe('in 2h 00m 00s');

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.countdown).toBe('in 1h 59m 59s');
  });

  it('shows days, the time zone and the live state', () => {
    const { result } = renderHook(() => useAgendaClient(PROPS));

    expect(result.current.days).toHaveLength(8);
    expect(result.current.showDays).toBe(true);
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.timeZone).toBe('America/Chicago');
    expect(result.current.liveLabel).toBe('Connecting...');
    expect(result.current.showRefreshFailed).toBe(false);
  });

  it('is empty with no pinned event when nothing is scheduled', () => {
    const { result } = renderHook(() =>
      useAgendaClient({ ...PROPS, initialRows: agendaRows([]) }),
    );

    expect(result.current.isEmpty).toBe(true);
    expect(result.current.showDays).toBe(false);
    expect(result.current.nextCard).toBeNull();
    expect(result.current.countdown).toBe('');
  });
});
