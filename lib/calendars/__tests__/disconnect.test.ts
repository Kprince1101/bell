import {
  disconnectAccount,
  releaseAllAccounts,
} from '@/lib/calendars/disconnect';
import { UnreadableTokenError } from '@/lib/crypto/tokenCipher';
import { GoogleApiError } from '@/lib/google/errors';
import {
  ACCOUNT_ID,
  CALENDAR_ID,
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

  it('treats a refresh token Bell can no longer decrypt as already gone', async () => {
    const { services, google, repo } = createFakeServices();
    repo.refreshToken.mockRejectedValue(new UnreadableTokenError());

    await disconnectAccount(services, accountRow());

    expect(google.stopChannel).not.toHaveBeenCalled();
    expect(google.revokeToken).not.toHaveBeenCalled();
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

describe('releaseAllAccounts', () => {
  const OTHER = accountRow({ id: 'aaaaaaaa-0000-0000-0000-000000000002' });

  it('stops the channels and revokes the token of each account, leaving the rows to delete_me', async () => {
    const { services, repo, google } = createFakeServices();
    repo.accountsForUser.mockResolvedValue([accountRow(), OTHER]);

    await releaseAllAccounts(services, USER_ID);

    expect(repo.accountsForUser).toHaveBeenCalledWith(USER_ID);
    expect(repo.calendarsForAccount).toHaveBeenNthCalledWith(1, ACCOUNT_ID);
    expect(repo.calendarsForAccount).toHaveBeenNthCalledWith(2, OTHER.id);
    expect(google.stopChannel).toHaveBeenCalledTimes(2);
    expect(google.revokeToken).toHaveBeenCalledTimes(2);
    expect(repo.deleteAccount).not.toHaveBeenCalled();
  });

  it('logs every failure and keeps going', async () => {
    const { services, repo, google, log } = createFakeServices();
    repo.accountsForUser.mockResolvedValue([accountRow(), OTHER]);
    repo.calendarsForAccount
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce([calendarRow(), SECOND_CALENDAR]);
    google.stopChannel
      .mockRejectedValueOnce(new GoogleApiError(503, 'Google 503'))
      .mockResolvedValueOnce(undefined);
    google.revokeToken.mockRejectedValue(new GoogleApiError(500, 'Google 500'));

    await expect(releaseAllAccounts(services, USER_ID)).resolves.toBe(
      undefined,
    );

    expect(log).toHaveBeenCalledWith(
      `[bell] delete-me release-failed account=${ACCOUNT_ID} error=db down`,
    );
    expect(log).toHaveBeenCalledWith(
      `[bell] delete-me unwatch-failed calendar=${CALENDAR_ID} channel=${CHANNEL_ID} error=Google 503`,
    );
    expect(google.stopChannel).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith(
      `[bell] delete-me revoke-failed account=${OTHER.id} error=Google 500`,
    );
  });
});
