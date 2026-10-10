import {
  SIGN_IN_REDIRECTS,
  callbackUrl,
  completeSignIn,
  getBellUser,
  isPublicPath,
  resolveLoginMessages,
} from '@/lib/auth';
import { BELL_USER, createSupabaseFake } from '@/test-utils/supabaseFake';

describe('callbackUrl', () => {
  it('carries the browser time zone to the callback', () => {
    expect(callbackUrl('https://bell.dontpanic.fyi', 'America/Chicago')).toBe(
      'https://bell.dontpanic.fyi/auth/callback?tz=America%2FChicago',
    );
  });
});

describe('completeSignIn', () => {
  it('fails without a code', async () => {
    const { client, fake } = createSupabaseFake();

    expect(await completeSignIn(client, null, 'UTC')).toBe('failed');
    expect(fake.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('claims the account with the resolved time zone', async () => {
    const { client, fake } = createSupabaseFake();

    expect(await completeSignIn(client, 'code-1', 'Europe/Paris')).toBe(
      'signed-in',
    );
    expect(fake.auth.exchangeCodeForSession).toHaveBeenCalledWith('code-1');
    expect(fake.rpc).toHaveBeenCalledWith('claim_account', {
      p_time_zone: 'Europe/Paris',
    });
    expect(fake.auth.signOut).not.toHaveBeenCalled();
  });

  it('sends UTC when the browser zone is unusable', async () => {
    const { client, fake } = createSupabaseFake();

    await completeSignIn(client, 'code-1', 'Mars/Olympus');

    expect(fake.rpc).toHaveBeenCalledWith('claim_account', {
      p_time_zone: 'UTC',
    });
  });

  it('refuses and signs out an email that is not invited', async () => {
    const { client, fake } = createSupabaseFake({
      rpcError: { code: '42501', message: 'not invited' },
    });

    expect(await completeSignIn(client, 'code-1', 'UTC')).toBe('not-invited');
    expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('signs out and fails on any other claim error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client, fake } = createSupabaseFake({
      rpcError: { code: 'PGRST202', message: 'missing' },
    });

    expect(await completeSignIn(client, 'code-1', 'UTC')).toBe('failed');
    expect(fake.auth.signOut).toHaveBeenCalled();
  });

  it('fails when the code exchange fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client, fake } = createSupabaseFake({
      exchangeError: new Error('bad code'),
    });

    expect(await completeSignIn(client, 'code-1', 'UTC')).toBe('failed');
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it('maps every outcome to a redirect', () => {
    expect(SIGN_IN_REDIRECTS).toEqual({
      'signed-in': '/',
      'not-invited': '/login?error=not-invited',
      failed: '/login?error=failed',
    });
  });
});

describe('getBellUser', () => {
  it('returns the bell row for the signed-in user', async () => {
    const { client, fake } = createSupabaseFake();

    expect(await getBellUser(client)).toEqual(BELL_USER);
    expect(fake.from).toHaveBeenCalledWith('users');
  });

  it('returns null when nobody is signed in', async () => {
    const { client, fake } = createSupabaseFake({ user: null });

    expect(await getBellUser(client)).toBeNull();
    expect(fake.from).not.toHaveBeenCalled();
  });
});

describe('isPublicPath', () => {
  it('only lets the login page and the callback through', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/auth/callback')).toBe(true);
    expect(isPublicPath('/')).toBe(false);
    expect(isPublicPath('/account')).toBe(false);
    expect(isPublicPath('/api/account')).toBe(false);
  });
});

describe('resolveLoginMessages', () => {
  it('turns known codes into copy and ignores unknown ones', () => {
    expect(resolveLoginMessages({ error: 'not-invited' }).error).toMatch(
      /not invited/,
    );
    expect(resolveLoginMessages({ notice: 'deleted' }).notice).toMatch(
      /deleted/,
    );
    expect(resolveLoginMessages({ error: '<script>' })).toEqual({
      error: null,
      notice: null,
    });
  });
});
