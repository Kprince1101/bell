import {
  disconnectAccount,
  disconnectAllAccounts,
} from '@/lib/calendars/disconnect';
import { GoogleApiError } from '@/lib/google/errors';
import {
  ACCOUNT_ID,
  CHANNEL_ID,
  accountRow,
  calendarRow,
  createFakeServices,
} from '@/test-utils/calendarFakes';
import { USER_ID } from '@/test-utils/supabaseFake';

const SECOND_CALENDAR = calendarRow({
  id: 'cccccccc-0000-0000-0000-000000000002',
  channel_id: 'dddddddd-0000-0000-0000-000000000002',
  channel_resource_id: 'resource-9',
});
const INACTIVE = calendarRow({
  id: 'cccccccc-0000-0000-0000-000000000003',
  active: false,
  channel_id: null,
  channel_resource_id: null,
});

describe('disconnectAccount', () => {
  it('stops every channel, revokes the token, then removes the account and its events', async () => {
    const { services, google, repo } = createFakeServices();
    const order: string[] = [];
    repo.calendarsForAccount.mockResolvedValue([
      calendarRow(),
      SECOND_CALENDAR,
      INACTIVE,
    ]);
    google.stopChannel.mockImplementation(
      async (_token, channel: { id: string }) => {
        order.push(`stop ${channel.id}`);
      },
    );
    google.revokeToken.mockImplementation(async () => {
      order.push('revoke');
    });
    repo.deleteAccount.mockImplementation(async () => {
      order.push('delete');
    });

    await disconnectAccount(services, accountRow());

    expect(order).toEqual([
      `stop ${CHANNEL_ID}`,
      'stop dddddddd-0000-0000-0000-000000000002',
      'revoke',
      'delete',
    ]);
    expect(google.revokeToken).toHaveBeenCalledWith('refresh-1');
    expect(repo.deleteAccount).toHaveBeenCalledWith(ACCOUNT_ID);
  });

  it('carries on when Google already forgot the channel or the grant', async () => {
    const { services, google, repo } = createFakeServices();
    google.stopChannel.mockRejectedValue(new GoogleApiError(404, 'Google 404'));
    google.revokeToken.mockRejectedValue(
      new GoogleApiError(400, 'Google 400: invalid_token'),
    );

    await disconnectAccount(services, accountRow());

    expect(repo.deleteAccount).toHaveBeenCalledWith(ACCOUNT_ID);
  });

  it('keeps everything when Google cannot be reached, so the user can retry', async () => {
    const { services, google, repo } = createFakeServices();
    google.revokeToken.mockRejectedValue(new GoogleApiError(503, 'Google 503'));

    await expect(disconnectAccount(services, accountRow())).rejects.toThrow(
      'Google 503',
    );
    expect(repo.deleteAccount).not.toHaveBeenCalled();
  });
});

describe('disconnectAllAccounts', () => {
  it('disconnects each of the user accounts', async () => {
    const { services, repo, google } = createFakeServices();
    const other = accountRow({ id: 'aaaaaaaa-0000-0000-0000-000000000002' });
    repo.accountsForUser.mockResolvedValue([accountRow(), other]);

    await disconnectAllAccounts(services, USER_ID);

    expect(repo.accountsForUser).toHaveBeenCalledWith(USER_ID);
    expect(google.revokeToken).toHaveBeenCalledTimes(2);
    expect(repo.deleteAccount).toHaveBeenNthCalledWith(1, ACCOUNT_ID);
    expect(repo.deleteAccount).toHaveBeenNthCalledWith(2, other.id);
  });
});
