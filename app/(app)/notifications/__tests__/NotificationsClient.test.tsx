import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NotificationsClient } from '@/app/(app)/notifications/NotificationsClient';
import { acknowledgeEvent, testChannel } from '@/lib/notificationsApi';
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
    { kind: 'slack', configured: true, active: true, hint: 'Toptal' },
    { kind: 'pushover', configured: false, active: false, hint: null },
    { kind: 'sms', configured: true, active: true, hint: 'Number ending 0100' },
    {
      kind: 'voice',
      configured: true,
      active: true,
      hint: 'Number ending 0100',
    },
  ],
  calendars: [],
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
  notice: 'Slack connected. Bell just sent you a test DM.',
};

describe('NotificationsClient', () => {
  it('shows each channel with its state, hint and a Test button', () => {
    render(<NotificationsClient {...PROPS} />);

    expect(
      screen.getByText('Slack connected. Bell just sent you a test DM.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Reconnect Slack' }),
    ).toHaveAttribute('href', '/api/slack/connect');
    expect(screen.getByLabelText('Slack DM on')).toBeChecked();
    expect(screen.getByLabelText('Pushover on')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Test Pushover' }),
    ).toBeDisabled();
    expect(screen.getAllByText('Number ending 0100')).toHaveLength(2);
    expect(
      screen.getByText('Include a calendar on the Calendars page first.'),
    ).toBeInTheDocument();
  });

  it('tests a channel and acknowledges a ringing meeting', async () => {
    vi.mocked(testChannel).mockResolvedValue(undefined);
    vi.mocked(acknowledgeEvent).mockResolvedValue(undefined);
    render(<NotificationsClient {...PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: 'Test Phone call' }));
    await waitFor(() =>
      expect(
        screen.getByText('Test sent by Phone call. Check that it reached you.'),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));

    await waitFor(() =>
      expect(screen.getByText('Acknowledged')).toBeInTheDocument(),
    );
    expect(testChannel).toHaveBeenCalledWith('voice');
    expect(acknowledgeEvent).toHaveBeenCalledWith('evt-1');
    expect(screen.getByRole('link', { name: 'Join' })).toHaveAttribute(
      'href',
      'https://meet',
    );
  });
});
