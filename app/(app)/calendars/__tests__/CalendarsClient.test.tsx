import { fireEvent, render, screen } from '@testing-library/react';
import { CalendarsClient } from '@/app/(app)/calendars/CalendarsClient';
import { saveCalendarChoices, shareCalendar } from '@/lib/calendarsApi';
import { NO_SHARING, SHARING } from '@/test-utils/sharingFakes';

vi.mock('@/lib/calendarsApi', () => ({
  saveCalendarChoices: vi.fn(),
  disconnectGoogleAccount: vi.fn(),
  shareCalendar: vi.fn(),
  removeCalendarShare: vi.fn(),
}));
vi.mock('@/lib/navigation', () => ({ redirectTo: vi.fn() }));

const ACCOUNTS = [
  {
    id: 'acct-1',
    email: 'me@client.com',
    calendars: [
      {
        choice: {
          id: 'cal-1',
          active: true,
          paused: false,
          label: 'Client',
          color: '#4285f4',
        },
        googleCalendarId: 'me@client.com',
        health: {
          tone: 'unhealthy' as const,
          text: 'Unhealthy: Google 500',
        },
        details: [
          'Last sync: Oct 10, 2026, 6:00 AM',
          'Push channel expires: Oct 15, 2026, 7:00 AM',
          'Last error: Google 500',
        ],
      },
    ],
  },
];

describe('CalendarsClient', () => {
  it('offers to connect when nothing is connected yet', () => {
    render(
      <CalendarsClient
        accounts={[]}
        sharing={NO_SHARING}
        error={null}
        notice={null}
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Connect a Google account' }),
    ).toHaveAttribute('href', '/api/google/connect');
    expect(screen.getByText('No Google accounts yet')).toBeInTheDocument();
    expect(
      screen.getByText('Include a calendar above to share it.'),
    ).toBeInTheDocument();
  });

  it('shows each calendar with its health, visibly', () => {
    render(
      <CalendarsClient
        accounts={ACCOUNTS}
        sharing={NO_SHARING}
        error="Bad thing"
        notice={null}
      />,
    );

    expect(screen.getByText('me@client.com')).toBeInTheDocument();
    expect(screen.getByText('Unhealthy: Google 500')).toBeInTheDocument();
    expect(
      screen.getByText('Last sync: Oct 10, 2026, 6:00 AM'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Push channel expires: Oct 15, 2026, 7:00 AM'),
    ).toBeInTheDocument();
    expect(screen.getByText('Last error: Google 500')).toBeInTheDocument();
    expect(screen.getByLabelText('Pause me@client.com')).not.toBeChecked();
    expect(screen.getByText('Bad thing')).toBeInTheDocument();
    expect(screen.getByLabelText('Include me@client.com')).toBeChecked();
    expect(
      screen.getByRole('button', { name: 'Save calendars' }),
    ).toBeDisabled();
  });

  it('saves after a change', () => {
    vi.mocked(saveCalendarChoices).mockResolvedValue(undefined);
    render(
      <CalendarsClient
        accounts={ACCOUNTS}
        sharing={NO_SHARING}
        error={null}
        notice={null}
      />,
    );

    fireEvent.change(screen.getByLabelText('Label for me@client.com'), {
      target: { value: 'Client A' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save calendars' }));

    expect(saveCalendarChoices).toHaveBeenCalledWith([
      {
        id: 'cal-1',
        active: true,
        paused: false,
        label: 'Client A',
        color: '#4285f4',
      },
    ]);
  });

  it('shows who a calendar is shared with and shares it with another teammate', () => {
    vi.mocked(shareCalendar).mockResolvedValue(undefined);
    render(
      <CalendarsClient
        accounts={ACCOUNTS}
        sharing={SHARING}
        error={null}
        notice={null}
      />,
    );

    expect(screen.getByText('teammate@example.com')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Stop sharing' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Shared with you')).toBeInTheDocument();
    expect(screen.getByText('Team standups')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Share Client with'), {
      target: { value: 'second@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));

    expect(shareCalendar).toHaveBeenCalledWith('cal-1', 'second@example.com');
  });
});
