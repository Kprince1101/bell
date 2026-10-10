import { useDeleteAccount } from '@/hooks/useDeleteAccount';
import { useTimeZoneSetting } from '@/hooks/useTimeZoneSetting';
import type { AccountClientProps } from '@/types/account';

export type TimeZoneSetting = ReturnType<typeof useTimeZoneSetting>;
export type AccountDeletion = ReturnType<typeof useDeleteAccount>;

export const useAccountClient = ({ timeZone }: AccountClientProps) => ({
  timeZoneSetting: useTimeZoneSetting(timeZone),
  deletion: useDeleteAccount(),
});
