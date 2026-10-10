import { connectGoogleAccount } from '@/lib/calendars/connect';
import type { BellServices } from '@/lib/calendars/services';
import { CALENDARS_PATH } from '@/lib/constants';
import { safeEqual } from '@/lib/crypto/tokenCipher';

export const GOOGLE_STATE_COOKIE = 'bell_google_state';

export const GOOGLE_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/api/google',
  maxAge: 600,
};

export type ConnectOutcome = 'connected' | 'denied' | 'failed';

export const CONNECT_REDIRECTS: Record<ConnectOutcome, string> = {
  connected: `${CALENDARS_PATH}?notice=connected`,
  denied: `${CALENDARS_PATH}?error=connect-denied`,
  failed: `${CALENDARS_PATH}?error=connect-failed`,
};

export interface ConnectCallback {
  userId: string;
  code: string | null;
  state: string | null;
  expectedState: string | undefined;
  error: string | null;
}

export const completeGoogleConnect = async (
  services: BellServices,
  { userId, code, state, expectedState, error }: ConnectCallback,
): Promise<ConnectOutcome> => {
  if (error) return 'denied';
  if (!code || !state || !expectedState || !safeEqual(expectedState, state)) {
    return 'failed';
  }
  try {
    await connectGoogleAccount(services, userId, code);
    return 'connected';
  } catch (err) {
    console.error(err);
    return 'failed';
  }
};
