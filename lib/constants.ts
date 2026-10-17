export const APP_NAME = 'Bell';

export const DELETE_CONFIRMATION = 'DELETE';

export const NOT_INVITED_CODE = '42501';

export const NO_ACCOUNT_AUTH_CODES = [
  'signup_disabled',
  'otp_disabled',
  'user_not_found',
];

export const EMAIL_EXISTS_AUTH_CODE = 'email_exists';

export const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/auth/callback',
  '/api/webhooks/',
  '/api/tick',
];

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

export const NOT_INVITED_COPY =
  'That account is not invited to Bell. Ask the owner to add your email.';

export const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  'not-invited': NOT_INVITED_COPY,
  failed: 'Sign-in did not complete. Please try again.',
};

export const LOGIN_NOTICE_MESSAGES: Record<string, string> = {
  deleted: 'Your account and everything in it has been deleted.',
};

export const MINUTE_MS = 60_000;

export const HOUR_MS = 60 * MINUTE_MS;

export const DAY_MS = 24 * HOUR_MS;

export const AGENDA_DAYS = 8;

export const DUPLICATE_WINDOW_MS = 5 * MINUTE_MS;

export const CHANGE_MARKER_MS = DAY_MS;

export const VISIT_SESSION_GAP_MS = 30 * MINUTE_MS;

export const CLOCK_TICK_MS = 1000;

export const AGENDA_REFRESH_DELAY_MS = 400;

export const CALENDARS_PATH = '/calendars';

export const CALENDAR_ERROR_MESSAGES: Record<string, string> = {
  'connect-denied': 'Google access was not granted, so nothing was connected.',
  'connect-failed':
    'Connecting that Google account did not complete. Please try again.',
};

export const CALENDAR_NOTICE_MESSAGES: Record<string, string> = {
  connected:
    'Google account connected. Pick the calendars Bell should include.',
  disconnected: 'Google account disconnected and its events removed.',
  saved: 'Calendars saved.',
};

export const INVITE_MESSAGES = {
  notOwner: 'Only the owner can invite people.',
  invalidEmail: 'Enter a valid email address.',
};
