import { OAUTH_STATE_COOKIE_OPTIONS } from '@/lib/oauthCallback';

export const SLACK_STATE_COOKIE_OPTIONS = {
  ...OAUTH_STATE_COOKIE_OPTIONS,
  path: '/api/slack',
};
