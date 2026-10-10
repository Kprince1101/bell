import { act, renderHook } from '@testing-library/react';
import { useAgendaRows } from '@/hooks/useAgendaRows';
import { loadAgendaRows } from '@/lib/agenda/read';
import { AGENDA_REFRESH_DELAY_MS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import { AGENDA_NOW, agendaEvent, agendaRows } from '@/test-utils/agendaFakes';
import { createRealtimeFake } from '@/test-utils/realtimeFake';
import { USER_ID } from '@/test-utils/supabaseFake';

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/agenda/read', () => ({ loadAgendaRows: vi.fn() }));

const INITIAL = agendaRows([agendaEvent()]);
const REFRESHED = agendaRows([
  agendaEvent(),
  agendaEvent({ id: 'evt-2', title: 'Added' }),
]);

const setup = () => {
  const realtime = createRealtimeFake();
  vi.mocked(createClient).mockReturnValue(
    realtime.client as unknown as ReturnType<typeof createClient>,
  );
  const hook = renderHook(() =>
    useAgendaRows({
      userId: USER_ID,
      timeZone: 'America/Chicago',
      initialRows: INITIAL,
    }),
  );
  return { realtime, ...hook };
};

const settle = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(AGENDA_REFRESH_DELAY_MS);
  });
};

describe('useAgendaRows', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AGENDA_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('subscribes to the user’s events and reports when it is live', () => {
    const { realtime, result } = setup();

    expect(realtime.client.channel).toHaveBeenCalledWith(`agenda:${USER_ID}`);
    expect(realtime.channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'bell',
        table: 'events',
        filter: `user_id=eq.${USER_ID}`,
      },
      expect.any(Function),
    );
    expect(result.current.rows).toBe(INITIAL);
    expect(result.current.isLive).toBe(false);

    act(() => realtime.emitStatus('SUBSCRIBED'));
    expect(result.current.isLive).toBe(true);
    act(() => realtime.emitStatus('CHANNEL_ERROR'));
    expect(result.current.isLive).toBe(false);
  });

  it('reloads the agenda once after a burst of changes', async () => {
    vi.mocked(loadAgendaRows).mockResolvedValue(REFRESHED);
    const { realtime, result } = setup();

    act(() => {
      realtime.emitChange();
      realtime.emitChange();
      realtime.emitChange();
    });
    await settle();

    expect(loadAgendaRows).toHaveBeenCalledTimes(1);
    expect(vi.mocked(loadAgendaRows).mock.calls[0].slice(1)).toEqual([
      USER_ID,
      { from: '2026-10-09T05:00:00.000Z', to: '2026-10-19T05:00:00.000Z' },
    ]);
    expect(result.current.rows).toBe(REFRESHED);
  });

  it('reloads when the page becomes visible again', async () => {
    vi.mocked(loadAgendaRows).mockResolvedValue(REFRESHED);
    const { result } = setup();

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle();

    expect(result.current.rows).toBe(REFRESHED);
  });

  it('keeps the last agenda and says so when a reload fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(loadAgendaRows).mockRejectedValueOnce(new Error('offline'));
    const { realtime, result } = setup();

    act(() => realtime.emitChange());
    await settle();

    expect(result.current.rows).toBe(INITIAL);
    expect(result.current.refreshFailed).toBe(true);

    vi.mocked(loadAgendaRows).mockResolvedValueOnce(REFRESHED);
    act(() => realtime.emitChange());
    await settle();
    expect(result.current.refreshFailed).toBe(false);
  });

  it('unsubscribes on unmount', () => {
    const { realtime, unmount } = setup();

    unmount();

    expect(realtime.client.removeChannel).toHaveBeenCalledWith(
      realtime.channel,
    );
  });
});
