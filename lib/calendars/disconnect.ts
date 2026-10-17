import type { BellServices } from '@/lib/calendars/services';
import { isGoneOrUnreadable, stopWatch } from '@/lib/calendars/watch';
import { getErrorMessage } from '@/lib/errors';
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
    if (!isGoneOrUnreadable(err)) throw err;
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

const attempt = async (
  services: BellServices,
  what: string,
  step: () => Promise<void>,
): Promise<void> => {
  try {
    await step();
  } catch (err) {
    services.log(`[bell] ${what} error=${getErrorMessage(err)}`);
  }
};

const releaseAccount = async (
  services: BellServices,
  account: AccountRow,
): Promise<void> => {
  const calendars = await services.repo.calendarsForAccount(account.id);
  for (const calendar of calendars) {
    await attempt(
      services,
      `delete-me unwatch-failed calendar=${calendar.id} channel=${calendar.channel_id}`,
      () => stopWatch(services, calendar),
    );
  }
  await attempt(services, `delete-me revoke-failed account=${account.id}`, () =>
    revokeAccount(services, account.id),
  );
};

export const releaseAllAccounts = async (
  services: BellServices,
  userId: string,
): Promise<void> => {
  for (const account of await services.repo.accountsForUser(userId)) {
    await attempt(
      services,
      `delete-me release-failed account=${account.id}`,
      () => releaseAccount(services, account),
    );
  }
};
