import { fireEvent, render, screen } from '@testing-library/react';
import { AccountClient } from '@/app/(app)/account/AccountClient';
import { requestAccountDeletion } from '@/lib/accountApi';

vi.mock('@/lib/accountApi', () => ({
  requestAccountDeletion: vi.fn(),
  saveTimeZone: vi.fn(),
}));
vi.mock('@/lib/navigation', () => ({ redirectTo: vi.fn() }));

describe('AccountClient', () => {
  it('shows the account and keeps Delete disabled until DELETE is typed', () => {
    render(
      <AccountClient
        email="me@example.com"
        timeZone="UTC"
        timeZones={['UTC', 'Asia/Tokyo']}
      />,
    );
    const button = screen.getByRole('button', { name: 'Delete my account' });

    expect(screen.getByText('me@example.com')).toBeInTheDocument();
    expect(screen.getByLabelText('Time zone')).toHaveValue('UTC');
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), {
      target: { value: 'DELETE' },
    });

    expect(button).toBeEnabled();
  });

  it('calls the delete endpoint on submit', async () => {
    vi.mocked(requestAccountDeletion).mockResolvedValue(undefined);
    render(
      <AccountClient
        email="me@example.com"
        timeZone="UTC"
        timeZones={['UTC']}
      />,
    );

    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), {
      target: { value: 'DELETE' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));

    expect(requestAccountDeletion).toHaveBeenCalledTimes(1);
  });
});
