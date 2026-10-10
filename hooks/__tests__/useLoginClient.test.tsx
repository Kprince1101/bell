import { act, renderHook } from '@testing-library/react';
import type { ChangeEvent, FormEvent } from 'react';
import { useLoginClient } from '@/hooks/useLoginClient';
import { createClient } from '@/lib/supabase/client';

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));

const authFake = () => {
  const auth = {
    signInWithOtp: vi.fn(async () => ({ data: {}, error: null as unknown })),
    signInWithOAuth: vi.fn(async () => ({ data: {}, error: null as unknown })),
  };
  vi.mocked(createClient).mockReturnValue({ auth } as unknown as ReturnType<
    typeof createClient
  >);
  return auth;
};

const submitEvent = () =>
  ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;

const typed = (value: string) =>
  ({ target: { value } }) as ChangeEvent<HTMLInputElement>;

const expectedCallback = () => {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `${window.location.origin}/auth/callback?tz=${encodeURIComponent(zone)}`;
};

describe('useLoginClient', () => {
  it('shows the server-provided error until something newer replaces it', () => {
    authFake();
    const { result } = renderHook(() =>
      useLoginClient({ error: 'not invited', notice: null }),
    );

    expect(result.current.showError).toBe(true);
    expect(result.current.errorMessage).toBe('not invited');
    expect(result.current.showNotice).toBe(false);
  });

  it('emails a magic link that returns with the browser time zone', async () => {
    const auth = authFake();
    const { result } = renderHook(() =>
      useLoginClient({ error: null, notice: null }),
    );

    act(() => result.current.handleEmailChange(typed(' me@example.com ')));
    await act(() => result.current.handleMagicLink(submitEvent()));

    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'me@example.com',
      options: { emailRedirectTo: expectedCallback() },
    });
    expect(result.current.noticeMessage).toBe(
      'Check me@example.com for a sign-in link.',
    );
    expect(result.current.submitLabel).toBe('Email me a sign-in link');
  });

  it('shows the auth error when the link cannot be sent', async () => {
    const auth = authFake();
    auth.signInWithOtp.mockResolvedValue({
      data: {},
      error: new Error('This email is not invited to Bell.'),
    });
    const { result } = renderHook(() =>
      useLoginClient({ error: null, notice: null }),
    );

    await act(() => result.current.handleMagicLink(submitEvent()));

    expect(result.current.errorMessage).toBe(
      'This email is not invited to Bell.',
    );
    expect(result.current.showNotice).toBe(false);
  });

  it('starts Google sign-in with the same callback', async () => {
    const auth = authFake();
    const { result } = renderHook(() =>
      useLoginClient({ error: null, notice: null }),
    );

    await act(() => result.current.handleGoogle());

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: expectedCallback() },
    });
    expect(result.current.isRedirecting).toBe(true);
  });

  it('re-enables Google when the redirect cannot start', async () => {
    const auth = authFake();
    auth.signInWithOAuth.mockResolvedValue({
      data: {},
      error: new Error('provider disabled'),
    });
    const { result } = renderHook(() =>
      useLoginClient({ error: null, notice: null }),
    );

    await act(() => result.current.handleGoogle());

    expect(result.current.isRedirecting).toBe(false);
    expect(result.current.errorMessage).toBe('provider disabled');
  });
});
