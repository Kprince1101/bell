import { z } from 'zod';
import { DELETE_CONFIRMATION } from '@/lib/constants';
import { isValidTimeZone } from '@/lib/timeZone';

export const updateTimeZoneBody = z.object({
  timeZone: z.string().refine(isValidTimeZone, 'Unknown time zone'),
});

export const deleteAccountBody = z.object({
  confirm: z.literal(DELETE_CONFIRMATION),
});

export type UpdateTimeZoneBody = z.infer<typeof updateTimeZoneBody>;
export type DeleteAccountBody = z.infer<typeof deleteAccountBody>;
