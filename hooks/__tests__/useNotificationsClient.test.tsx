import { act, renderHook } from '@testing-library/react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNotificationsClient } from '@/hooks/useNotificationsClient';
import { redirectTo } from '@/lib/navigation';
import {
  acknowledgeEvent,
  savePhoneNumber,
  setCalendarQuiet,
  setChannelActive,
  testChannel,
} from '@/lib/notificationsApi';
import type { NotificationsClientProps } from '@/types/notifications';

vi.mock('@/lib/notificationsApi', () => ({
  savePushoverKey: vi.fn(),
  savePhoneNumber: vi.fn(),
  setChannelActive: vi.fn(),
  testChannel: vi.fn(),
  setCalendarQuiet: vi.fn(),
  acknowledgeEvent: vi.fn(),
}));
vi.mock('@/lib/navigation', () => ({ redirectTo: vi.fn() }));

const PROPS: NotificationsClientProps = {
  channels: [
    { kind: 'slack', configured: false, active: false, hint: null },
    {
      kind: 'pushover',
      configured: true,
      active: true,
      hint: 'User key ending abcd',
    },
    { kind: 'sms', configured: true, active: true, hint: 'Number ending 0100' },
    {
      kind: 'voice',
      configured: true,
      active: false,
      hint: 'Number ending 0100',
    },
  ],
  calendars: [{ id: 'cal-1', label: 'Work', color: '#4285f4', quiet: false }],
  ringing: [
    {
      eventId: 'evt-1',
      title: 'Client sync',
      when: '2:00 PM CDT',
      joinUrl: 'https://meet',
      status: 'Ringing',
    },
  ],
  error: null,
  notice: null,
};

const checkbox = (checked: boolean) =>
  ({ target: { checked } }) as unknown as ChangeEvent<HTMLInputElement>;

const typed = (value: string) =>
  ({ target: { value } }) as unknown as ChangeEvent<HTMLInputElement>;

const submit = () =>
  ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;

describe('useNotificationsClient', () => {
  it('only lets set-up channels be switched or tested', () => {
    const { result } = renderHook(() => useNotificationsClient(PROPS));

    expect(result.current.switches.slack.canToggle).toBe(false);
    expect(result.current.switches.slack.canTest).toBe(false);
    expect(result.current.switches.voice.canToggle).toBe(true);
    expect(result.current.switches.voice.active).toBe(false);
    expect(result.current.slackConnectLabel).toBe('Add to Slack');
  });

  it('switches a channel on and keeps it on after the save', async () => {
    vi.mocked(setChannelActive).mockResolvedValue(undefined);
    const { result } = renderHook(() => useNotificationsClient(PROPS));

    await act(() => result.current.switches.voice.onToggle(checkbox(true)));

    expect(setChannelActive).toHaveBeenCalledWith('voice', true);
    expect(result.current.switches.voice.active).toBe(true);
  });

  it('reports a test that went through and one that did not', async () => {
    vi.mocked(testChannel).mockResolvedValueOnce(undefined);
    vi.mocked(testChannel).mockRejectedValueOnce(
      new Error('The test did not go through.'),
    );
    const { result } = renderHook(() => useNotificationsClient(PROPS));

    await act(() => result.current.switches.sms.onTest());
    expect(result.current.channelRequest.notice).toBe(
      'Test sent by Text message. Check that it reached you.',
    );
    await act(() => result.current.switches.pushover.onTest());
    expect(result.current.channelRequest.error).toBe(
      'The test did not go through.',
    );
  });

  it('saves a phone number and reloads with a notice', async () => {
    vi.mocked(savePhoneNumber).mockResolvedValue(undefined);
    const { result } = renderHook(() => useNotificationsClient(PROPS));

    act(() => result.current.phone.handleChange(typed(' +15125550100 ')));
    await act(() => result.current.phone.handleSubmit(submit()));

    expect(savePhoneNumber).toHaveBeenCalledWith('+15125550100');
    expect(redirectTo).toHaveBeenCalledWith(
      '/notifications?notice=channel-saved',
    );
  });

  it('keeps the typed value and shows why a save failed', async () => {
    vi.mocked(savePhoneNumber).mockRejectedValue(
      new Error('Use the international format'),
    );
    const { result } = renderHook(() => useNotificationsClient(PROPS));

    act(() => result.current.phone.handleChange(typed('5550100')));
    await act(() => result.current.phone.handleSubmit(submit()));

    expect(result.current.phone.showError).toBe(true);
    expect(result.current.phone.value).toBe('5550100');
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it('quiets a calendar', async () => {
    vi.mocked(setCalendarQuiet).mockResolvedValue(undefined);
    const { result } = renderHook(() => useNotificationsClient(PROPS));

    await act(() => result.current.quiet.rows[0].onToggle(checkbox(true)));

    expect(setCalendarQuiet).toHaveBeenCalledWith('cal-1', true);
    expect(result.current.quiet.rows[0].quiet).toBe(true);
  });

  it('acknowledges a ringing meeting from the app', async () => {
    vi.mocked(acknowledgeEvent).mockResolvedValue(undefined);
    const { result } = renderHook(() => useNotificationsClient(PROPS));

    expect(result.current.events.rows[0].showAcknowledge).toBe(true);
    await act(() => result.current.events.rows[0].onAcknowledge());

    expect(acknowledgeEvent).toHaveBeenCalledWith('evt-1');
    expect(result.current.events.rows[0].isAcknowledged).toBe(true);
    expect(result.current.events.rows[0].showAcknowledge).toBe(false);
  });
});
