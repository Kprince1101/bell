import type { GoogleEvent } from '@/lib/google/schemas';

export const STANDUP: GoogleEvent = {
  id: 'standup',
  status: 'confirmed',
  summary: 'Standup',
  location: 'Room 4',
  start: { dateTime: '2026-10-12T09:00:00-05:00', timeZone: 'America/Chicago' },
  end: { dateTime: '2026-10-12T09:15:00-05:00', timeZone: 'America/Chicago' },
  organizer: { email: 'boss@client.com', displayName: 'Boss' },
  attendees: [
    { email: 'me@gmail.com', responseStatus: 'accepted', self: true },
    { email: 'boss@client.com', responseStatus: 'accepted', organizer: true },
  ],
  hangoutLink: 'https://meet.google.com/abc-defg-hij',
};

export const STANDUP_MOVED: GoogleEvent = {
  ...STANDUP,
  start: { dateTime: '2026-10-12T10:00:00-05:00', timeZone: 'America/Chicago' },
  end: { dateTime: '2026-10-12T10:15:00-05:00', timeZone: 'America/Chicago' },
};

export const CLIENT_REVIEW_ET: GoogleEvent = {
  id: 'client-review',
  status: 'confirmed',
  summary: 'Client review',
  start: {
    dateTime: '2026-10-12T13:00:00-04:00',
    timeZone: 'America/New_York',
  },
  end: {
    dateTime: '2026-10-12T14:00:00-04:00',
    timeZone: 'America/New_York',
  },
  organizer: { email: 'pm@client.com' },
};

export const STANDUP_DELETED: GoogleEvent = {
  id: 'standup',
  status: 'cancelled',
};

export const OFFSITE: GoogleEvent = {
  id: 'offsite',
  status: 'tentative',
  summary: 'Offsite',
  start: { date: '2026-10-20' },
  end: { date: '2026-10-21' },
};

export const ZOOM_CALL: GoogleEvent = {
  id: 'zoom-call',
  summary: 'Client sync',
  location: 'Zoom: https://client.zoom.us/j/123456?pwd=abc (passcode 1)',
  start: { dateTime: '2026-10-13T15:00:00Z' },
  end: { dateTime: '2026-10-13T15:30:00Z' },
  conferenceData: {
    entryPoints: [{ entryPointType: 'phone', uri: 'tel:+1-555-0100' }],
  },
};

export const TEAMS_CALL: GoogleEvent = {
  id: 'teams-call',
  summary: 'Review',
  start: { dateTime: '2026-10-14T15:00:00Z' },
  end: { dateTime: '2026-10-14T16:00:00Z' },
  conferenceData: {
    entryPoints: [
      {
        entryPointType: 'video',
        uri: 'https://teams.microsoft.com/l/meetup/1',
      },
    ],
  },
};

export const WEEKLY_INSTANCE: GoogleEvent = {
  id: 'weekly_20261015T140000Z',
  status: 'confirmed',
  summary: 'Weekly',
  recurringEventId: 'weekly',
  originalStartTime: { dateTime: '2026-10-15T14:00:00Z' },
  start: { dateTime: '2026-10-15T14:00:00Z' },
  end: { dateTime: '2026-10-15T15:00:00Z' },
};

export const WEEKLY_SERIES_DELETED: GoogleEvent = {
  id: 'weekly',
  status: 'cancelled',
};

export const FAR_FUTURE: GoogleEvent = {
  id: 'far-future',
  summary: 'Annual review',
  start: { dateTime: '2027-01-20T15:00:00Z' },
  end: { dateTime: '2027-01-20T16:00:00Z' },
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const HALF_HOUR_MS = 30 * 60 * 1000;

export const weeklySeries = (
  firstStart: string,
  weeks: number,
): GoogleEvent[] =>
  Array.from({ length: weeks }, (_, week) => {
    const startMs = Date.parse(firstStart) + week * WEEK_MS;
    const start = new Date(startMs).toISOString();
    return {
      id: `series_${startMs}`,
      status: 'confirmed',
      summary: 'Series standup',
      recurringEventId: 'series',
      originalStartTime: { dateTime: start },
      start: { dateTime: start },
      end: { dateTime: new Date(startMs + HALF_HOUR_MS).toISOString() },
    };
  });
