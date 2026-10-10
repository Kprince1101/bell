import { z } from 'zod';

export const calendarChoicesBody = z.object({
  calendars: z
    .array(
      z.object({
        id: z.guid(),
        active: z.boolean(),
        paused: z.boolean(),
        label: z.string().trim().min(1).max(100),
        color: z
          .string()
          .regex(/^#[0-9a-f]{6}$/i)
          .transform((color) => color.toLowerCase()),
      }),
    )
    .min(1)
    .max(200),
});

export type CalendarChoicesBody = z.infer<typeof calendarChoicesBody>;

export const shareBody = z.object({
  calendarId: z.guid(),
  email: z
    .email('Enter your teammate’s email address.')
    .max(320)
    .transform((email) => email.toLowerCase()),
});

export const unshareBody = z.object({
  calendarId: z.guid(),
  sharedWithUserId: z.guid(),
});

export const shareOutcome = z.enum([
  'shared',
  'unknown_calendar',
  'unknown_user',
  'self',
]);

export type ShareOutcome = z.infer<typeof shareOutcome>;

export const sharedWithMeRows = z.array(
  z.object({ id: z.guid(), label: z.string(), color: z.string() }),
);

export const myShareRows = z.array(
  z.object({
    calendar_id: z.guid(),
    shared_with_user_id: z.guid(),
    email: z.string(),
  }),
);
