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
