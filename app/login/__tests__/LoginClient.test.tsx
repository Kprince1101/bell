import { render, screen } from '@testing-library/react';
import { LoginClient } from '@/app/login/LoginClient';

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));

describe('LoginClient', () => {
  it('offers Google and a magic link', () => {
    render(<LoginClient error={null} notice={null} />);

    expect(
      screen.getByRole('button', { name: 'Continue with Google' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Email me a sign-in link' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows why a sign-in was refused', () => {
    render(<LoginClient error="Not invited." notice={null} />);

    expect(screen.getByRole('status')).toHaveTextContent('Not invited.');
  });
});
