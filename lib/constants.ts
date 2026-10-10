export const APP_NAME = 'Bell';

export const DELETE_CONFIRMATION = 'DELETE';

export const NOT_INVITED_CODE = '42501';

export const PUBLIC_PATH_PREFIXES = ['/login', '/auth/callback'];

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

export const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  'not-invited':
    'That account is not invited to Bell. Ask the owner to add your email.',
  failed: 'Sign-in did not complete. Please try again.',
};

export const LOGIN_NOTICE_MESSAGES: Record<string, string> = {
  deleted: 'Your account and everything in it has been deleted.',
};
