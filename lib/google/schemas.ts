import { z } from 'zod';

export const googleTokenResponse = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  id_token: z.string().optional(),
  expires_in: z.number().optional(),
  scope: z.string().optional(),
});

export const googleIdTokenClaims = z.object({
  sub: z.string(),
  email: z.string(),
});

export const googleCalendarListEntry = z.object({
  id: z.string(),
  summary: z.string().optional(),
  summaryOverride: z.string().optional(),
  backgroundColor: z.string().optional(),
  timeZone: z.string().optional(),
  primary: z.boolean().optional(),
  accessRole: z.string().optional(),
});

export const googleCalendarListPage = z.object({
  items: z.array(googleCalendarListEntry).default([]),
  nextPageToken: z.string().optional(),
});

const googleEventDateTime = z.object({
  date: z.string().optional(),
  dateTime: z.string().optional(),
  timeZone: z.string().optional(),
});

const googleEventPerson = z.object({
  email: z.string().optional(),
  displayName: z.string().optional(),
  responseStatus: z.string().optional(),
  optional: z.boolean().optional(),
  organizer: z.boolean().optional(),
  self: z.boolean().optional(),
});

export const googleEvent = z.object({
  id: z.string(),
  status: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  start: googleEventDateTime.optional(),
  end: googleEventDateTime.optional(),
  recurringEventId: z.string().optional(),
  originalStartTime: googleEventDateTime.optional(),
  organizer: googleEventPerson.optional(),
  attendees: z.array(googleEventPerson).optional(),
  hangoutLink: z.string().optional(),
  conferenceData: z
    .object({
      entryPoints: z
        .array(
          z.object({
            entryPointType: z.string().optional(),
            uri: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export const googleEventsPage = z.object({
  items: z.array(googleEvent).default([]),
  nextPageToken: z.string().optional(),
  nextSyncToken: z.string().optional(),
  timeZone: z.string().optional(),
});

export const googleWatchResponse = z.object({
  id: z.string(),
  resourceId: z.string(),
  expiration: z.coerce.number().optional(),
});

export const googleErrorBody = z.object({
  error: z
    .union([
      z.string(),
      z.object({ message: z.string().optional(), code: z.number().optional() }),
    ])
    .optional(),
  error_description: z.string().optional(),
});

export type GoogleTokenResponse = z.infer<typeof googleTokenResponse>;
export type GoogleIdTokenClaims = z.infer<typeof googleIdTokenClaims>;
export type GoogleCalendarListEntry = z.infer<typeof googleCalendarListEntry>;
export type GoogleEventDateTime = z.infer<typeof googleEventDateTime>;
export type GoogleEventPerson = z.infer<typeof googleEventPerson>;
export type GoogleEvent = z.infer<typeof googleEvent>;
export type GoogleEventsPage = z.infer<typeof googleEventsPage>;
export type GoogleWatchResponse = z.infer<typeof googleWatchResponse>;
