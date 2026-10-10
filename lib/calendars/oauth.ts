import { connectGoogleAccount } from '@/lib/calendars/connect';
import type { BellServices } from '@/lib/calendars/services';
import { CALENDARS_PATH } from '@/lib/constants';
import {
  OAUTH_STATE_COOKIE_OPTIONS,
  completeOAuthCallback,
} from '@/lib/oauthCallback';
import type { ConnectOutcome, OAuthCallback } from '@/lib/oauthCallback';

export type { ConnectOutcome } from '@/lib/oauthCallback';

export const GOOGLE_STATE_COOKIE = 'bell_google_state';

export const GOOGLE_STATE_COOKIE_OPTIONS = {
  ...OAUTH_STATE_COOKIE_OPTIONS,
  path: '/api/google',
};

export const CONNECT_REDIRECTS: Record<ConnectOutcome, string> = {
  connected: `${CALENDARS_PATH}?notice=connected`,
  denied: `${CALENDARS_PATH}?error=connect-denied`,
  failed: `${CALENDARS_PATH}?error=connect-failed`,
};

export interface ConnectCallback extends OAuthCallback {
  userId: string;
}

export const completeGoogleConnect = (
  services: BellServices,
  { userId, ...callback }: ConnectCallback,
): Promise<ConnectOutcome> =>
  completeOAuthCallback(callback, (code) =>
    connectGoogleAccount(services, userId, code),
  );
