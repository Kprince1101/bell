import type { BellServices } from '@/lib/calendars/services';
import { stopWatch } from '@/lib/calendars/watch';
import { isAlreadyGone } from '@/lib/google/errors';
import type { AccountRow } from '@/types/calendar';

const revokeAccount = async (
  services: BellServices,
  accountId: string,
): Promise<void> => {
  try {
    await services.google.revokeToken(
      await services.repo.refreshToken(accountId),
    );
  } catch (err) {
    if (!isAlreadyGone(err)) throw err;
  }
};

export const disconnectAccount = async (
  services: BellServices,
  account: AccountRow,
): Promise<void> => {
  const calendars = await services.repo.calendarsForAccount(account.id);
  for (const calendar of calendars) await stopWatch(services, calendar);
  await revokeAccount(services, account.id);
  await services.repo.deleteAccount(account.id);
  services.log(
    `[bell] disconnect account=${account.id} calendars=${calendars.length}`,
  );
};

export const disconnectAllAccounts = async (
  services: BellServices,
  userId: string,
): Promise<void> => {
  for (const account of await services.repo.accountsForUser(userId)) {
    await disconnectAccount(services, account);
  }
};
