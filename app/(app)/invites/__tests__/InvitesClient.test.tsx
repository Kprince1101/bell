import { act, fireEvent, render, screen } from '@testing-library/react';
import { inviteAction } from '@/app/(app)/invites/actions';
import { InvitesClient } from '@/app/(app)/invites/InvitesClient';
import { INVITES } from '@/test-utils/supabaseFake';

vi.mock('@/app/(app)/invites/actions', () => ({ inviteAction: vi.fn() }));

describe('InvitesClient', () => {
  it('lists the allowlist', () => {
    render(<InvitesClient invites={INVITES} />);

    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByText('owner')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('submits the email and shows the result', async () => {
    vi.mocked(inviteAction).mockResolvedValue({
      status: 'invited',
      message: 'new@example.com can now sign in.',
    });
    render(<InvitesClient invites={INVITES} />);

    fireEvent.change(screen.getByLabelText('Email to invite'), {
      target: { value: 'new@example.com' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'new@example.com can now sign in.',
    );
    const submitted = vi.mocked(inviteAction).mock.calls[0][1];
    expect(submitted.get('email')).toBe('new@example.com');
  });
});
