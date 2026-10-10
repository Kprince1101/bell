import { fireEvent, render, screen } from '@testing-library/react';
import { CalendarsClient } from '@/app/(app)/calendars/CalendarsClient';
import { saveCalendarChoices } from '@/lib/calendarsApi';

vi.mock('@/lib/calendarsApi', () => ({
  saveCalendarChoices: vi.fn(),
  disconnectGoogleAccount: vi.fn(),
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
          label: 'Client',
          color: '#4285f4',
        },
        googleCalendarId: 'me@client.com',
        health: {
          tone: 'unhealthy' as const,
          text: 'Unhealthy: Google 500',
        },
      },
    ],
  },
];

describe('CalendarsClient', () => {
  it('offers to connect when nothing is connected yet', () => {
    render(<CalendarsClient accounts={[]} error={null} notice={null} />);

    expect(
      screen.getByRole('link', { name: 'Connect a Google account' }),
    ).toHaveAttribute('href', '/api/google/connect');
    expect(screen.getByText('No Google accounts yet')).toBeInTheDocument();
  });

  it('shows each calendar with its health, visibly', () => {
    render(
      <CalendarsClient accounts={ACCOUNTS} error="Bad thing" notice={null} />,
    );

    expect(screen.getByText('me@client.com')).toBeInTheDocument();
    expect(screen.getByText('Unhealthy: Google 500')).toBeInTheDocument();
    expect(screen.getByText('Bad thing')).toBeInTheDocument();
    expect(screen.getByLabelText('Include me@client.com')).toBeChecked();
    expect(
      screen.getByRole('button', { name: 'Save calendars' }),
    ).toBeDisabled();
  });

  it('saves after a change', () => {
    vi.mocked(saveCalendarChoices).mockResolvedValue(undefined);
    render(<CalendarsClient accounts={ACCOUNTS} error={null} notice={null} />);

    fireEvent.change(screen.getByLabelText('Label for me@client.com'), {
      target: { value: 'Client A' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save calendars' }));

    expect(saveCalendarChoices).toHaveBeenCalledWith([
      { id: 'cal-1', active: true, label: 'Client A', color: '#4285f4' },
    ]);
  });
});
