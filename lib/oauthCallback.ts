import { safeEqual } from '@/lib/crypto/tokenCipher';

export type ConnectOutcome = 'connected' | 'denied' | 'failed';

export interface OAuthCallback {
  code: string | null;
  state: string | null;
  expectedState: string | undefined;
  error: string | null;
}

export const OAUTH_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  maxAge: 600,
};

export const completeOAuthCallback = async (
  { code, state, expectedState, error }: OAuthCallback,
  connect: (code: string) => Promise<unknown>,
): Promise<ConnectOutcome> => {
  if (error) return 'denied';
  if (!code || !state || !expectedState || !safeEqual(expectedState, state)) {
    return 'failed';
  }
  try {
    await connect(code);
    return 'connected';
  } catch (err) {
    console.error(err);
    return 'failed';
  }
};
