import { act, renderHook } from '@testing-library/react';
import { useNow } from '@/hooks/useNow';
import { AGENDA_NOW } from '@/test-utils/agendaFakes';

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AGENDA_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at the server’s time and ticks every second', () => {
    const { result, unmount } = renderHook(() =>
      useNow('2026-10-10T14:59:58.000Z'),
    );

    expect(result.current.toISOString()).toBe('2026-10-10T14:59:58.000Z');
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.toISOString()).toBe('2026-10-10T15:00:01.000Z');
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.toISOString()).toBe('2026-10-10T15:00:02.000Z');

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
