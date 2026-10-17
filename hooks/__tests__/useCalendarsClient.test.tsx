import { act, renderHook } from '@testing-library/react';
import type { ChangeEvent, FormEvent } from 'react';
import { useCalendarsClient } from '@/hooks/useCalendarsClient';
import {
  disconnectGoogleAccount,
  removeCalendarShare,
  saveCalendarChoices,
  shareCalendar,
} from '@/lib/calendarsApi';
import { redirectTo } from '@/lib/navigation';
import {
  NO_SHARING,
  SHARING,
  TEAMMATE_ID,
  VIEWER_ID,
} from '@/test-utils/sharingFakes';
import type { CalendarsClientProps } from '@/types/calendar';

vi.mock('@/lib/calendarsApi', () => ({
  saveCalendarChoices: vi.fn(),
  disconnectGoogleAccount: vi.fn(),
  shareCalendar: vi.fn(),
  removeCalendarShare: vi.fn(),
}));
vi.mock('@/lib/navigation', () => ({ redirectTo: vi.fn() }));

const choice = (id: string, active: boolean) => ({
  id,
  active,
  paused: false,
  label: `Calendar ${id}`,
  color: '#4285f4',
});

const PROPS: CalendarsClientProps = {
  accounts: [
    {
      id: 'acct-1',
      email: 'me@gmail.com',
      calendars: [
        {
          choice: choice('cal-1', true),
          googleCalendarId: 'me@gmail.com',
          health: { tone: 'healthy', text: 'Waiting for first sync' },
          details: ['Last sync: never', 'Push channel: none'],
        },
        {
          choice: choice('cal-2', false),
          googleCalendarId: 'family@group.calendar.google.com',
          health: { tone: 'off', text: 'Not included' },
          details: [],
        },
      ],
    },
  ],
  sharing: NO_SHARING,
  error: null,
  notice: 'Calendars saved.',
};

const submitEvent = () =>
  ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;

const input = (value: string, checked = false) =>
  ({ target: { value, checked } }) as unknown as ChangeEvent<HTMLInputElement>;

describe('useCalendarsClient', () => {
  it('builds one card per account with a row per calendar', () => {
    const { result } = renderHook(() => useCalendarsClient(PROPS));

    expect(result.current.hasAccounts).toBe(true);
    expect(result.current.showNotice).toBe(true);
    expect(result.current.accountCards[0].calendars).toHaveLength(2);
    expect(result.current.accountCards[0].disconnectLabel).toBe('Disconnect');
    expect(result.current.selection.canSave).toBe(false);
  });

  it('saves only the calendars that changed', async () => {
    vi.mocked(saveCalendarChoices).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCalendarsClient(PROPS));

    act(() =>
      result.current.accountCards[0].calendars[1].onToggle(input('', true)),
    );
    act(() =>
      result.current.accountCards[0].calendars[1].onColorChange(
        input('#ff0000'),
      ),
    );
    act(() =>
      result.current.accountCards[0].calendars[1].onLabelChange(
        input('Family'),
      ),
    );
    expect(result.current.selection.canSave).toBe(true);
    await act(() => result.current.selection.handleSave(submitEvent()));

    expect(saveCalendarChoices).toHaveBeenCalledWith([
      {
        id: 'cal-2',
        active: true,
        paused: false,
        label: 'Family',
        color: '#ff0000',
      },
    ]);
    expect(redirectTo).toHaveBeenCalledWith('/calendars?notice=saved');
  });

  it('offers pause only on included calendars and saves it', async () => {
    vi.mocked(saveCalendarChoices).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCalendarsClient(PROPS));
    const [included, excluded] = result.current.accountCards[0].calendars;

    expect(included.showPause).toBe(true);
    expect(excluded.showPause).toBe(false);
    expect(included.details).toEqual([
      'Last sync: never',
      'Push channel: none',
    ]);
    act(() => included.onPauseToggle(input('', true)));
    await act(() => result.current.selection.handleSave(submitEvent()));

    expect(saveCalendarChoices).toHaveBeenCalledWith([
      { ...choice('cal-1', true), paused: true },
    ]);
  });

  it('will not save a blank label', () => {
    const { result } = renderHook(() => useCalendarsClient(PROPS));

    act(() =>
      result.current.accountCards[0].calendars[0].onLabelChange(input('  ')),
    );

    expect(result.current.selection.canSave).toBe(false);
  });

  it('shows a failed save', async () => {
    vi.mocked(saveCalendarChoices).mockRejectedValue(
      new Error('Something went wrong. Please try again.'),
    );
    const { result } = renderHook(() => useCalendarsClient(PROPS));

    act(() =>
      result.current.accountCards[0].calendars[0].onToggle(input('', false)),
    );
    await act(() => result.current.selection.handleSave(submitEvent()));

    expect(result.current.selection.showSaveError).toBe(true);
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it('disconnects an account and reloads with a notice', async () => {
    vi.mocked(disconnectGoogleAccount).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCalendarsClient(PROPS));

    await act(() => result.current.accountCards[0].onDisconnect());

    expect(disconnectGoogleAccount).toHaveBeenCalledWith('acct-1');
    expect(redirectTo).toHaveBeenCalledWith('/calendars?notice=disconnected');
  });

  it('keeps the account and shows why when disconnecting fails', async () => {
    vi.mocked(disconnectGoogleAccount).mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => useCalendarsClient(PROPS));

    await act(() => result.current.accountCards[0].onDisconnect());

    expect(result.current.disconnect.disconnectError).toBe('nope');
    expect(redirectTo).not.toHaveBeenCalled();
  });
});

describe('useCalendarsClient sharing', () => {
  const SHARED_PROPS: CalendarsClientProps = { ...PROPS, sharing: SHARING };

  it('lists who each calendar is shared with and what is shared with me', () => {
    const { result } = renderHook(() => useCalendarsClient(SHARED_PROPS));
    const { sharing } = result.current;

    expect(sharing.hasCalendars).toBe(true);
    expect(sharing.calendars[0].recipients.map((r) => r.email)).toEqual([
      'teammate@example.com',
    ]);
    expect(sharing.calendars[0].recipients[0].removeLabel).toBe('Stop sharing');
    expect(sharing.calendars[0].canShare).toBe(false);
    expect(sharing.hasSharedWithMe).toBe(true);
    expect(sharing.sharedWithMe[0].label).toBe('Team standups');
  });

  it('shares a calendar with a typed email and reloads with a notice', async () => {
    vi.mocked(shareCalendar).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCalendarsClient(SHARED_PROPS));

    act(() =>
      result.current.sharing.calendars[0].onEmailChange(
        input(' new@example.com '),
      ),
    );
    expect(result.current.sharing.calendars[0].canShare).toBe(true);
    await act(() => result.current.sharing.calendars[0].onShare(submitEvent()));

    expect(shareCalendar).toHaveBeenCalledWith('cal-1', 'new@example.com');
    expect(redirectTo).toHaveBeenCalledWith('/calendars?notice=shared');
  });

  it('does nothing for a blank email', async () => {
    const { result } = renderHook(() => useCalendarsClient(SHARED_PROPS));

    await act(() => result.current.sharing.calendars[0].onShare(submitEvent()));

    expect(shareCalendar).not.toHaveBeenCalled();
  });

  it('shows why a share was refused', async () => {
    vi.mocked(shareCalendar).mockRejectedValue(
      new Error('Nobody with that email uses Bell yet.'),
    );
    const { result } = renderHook(() => useCalendarsClient(SHARED_PROPS));

    act(() =>
      result.current.sharing.calendars[0].onEmailChange(
        input('ghost@example.com'),
      ),
    );
    await act(() => result.current.sharing.calendars[0].onShare(submitEvent()));

    expect(result.current.sharing.showError).toBe(true);
    expect(result.current.sharing.error).toBe(
      'Nobody with that email uses Bell yet.',
    );
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it('stops sharing with a teammate', async () => {
    vi.mocked(removeCalendarShare).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCalendarsClient(SHARED_PROPS));

    await act(() =>
      result.current.sharing.calendars[0].recipients[0].onRemove(),
    );

    expect(removeCalendarShare).toHaveBeenCalledWith('cal-1', TEAMMATE_ID);
    expect(redirectTo).toHaveBeenCalledWith('/calendars?notice=unshared');
  });

  it('removes a calendar someone shared with me', async () => {
    vi.mocked(removeCalendarShare).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCalendarsClient(SHARED_PROPS));

    await act(() => result.current.sharing.sharedWithMe[0].onRemove());

    expect(removeCalendarShare).toHaveBeenCalledWith('cal-team', VIEWER_ID);
  });
});
