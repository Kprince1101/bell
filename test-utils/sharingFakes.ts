import type { SharingView } from '@/types/calendar';

export const VIEWER_ID = '33333333-3333-3333-3333-333333333333';

export const TEAMMATE_ID = '44444444-4444-4444-4444-444444444444';

export const NO_SHARING: SharingView = {
  userId: VIEWER_ID,
  owned: [],
  sharedWithMe: [],
};

export const SHARING: SharingView = {
  userId: VIEWER_ID,
  owned: [
    {
      calendarId: 'cal-1',
      label: 'Client',
      color: '#4285f4',
      recipients: [{ userId: TEAMMATE_ID, email: 'teammate@example.com' }],
    },
  ],
  sharedWithMe: [
    { calendarId: 'cal-team', label: 'Team standups', color: '#0b8043' },
  ],
};
