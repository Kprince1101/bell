import {
  PUSH_OUTCOME_STATUS,
  handlePushNotification,
  readPushNotification,
} from '@/lib/calendars/webhook';
import { signValue } from '@/lib/crypto/tokenCipher';
import { GoogleApiError } from '@/lib/google/errors';
import {
  CALENDAR_ID,
  CHANNEL_ID,
  TEST_CONFIG,
  calendarRow,
  createFakeServices,
} from '@/test-utils/calendarFakes';

const notification = (overrides = {}) => ({
  channelId: CHANNEL_ID,
  token: signValue(CHANNEL_ID, TEST_CONFIG.webhookSecret),
  resourceId: 'resource-1',
  resourceState: 'exists',
  ...overrides,
});

describe('readPushNotification', () => {
  it('reads the Google channel headers', () => {
    const headers = new Headers({
      'X-Goog-Channel-ID': CHANNEL_ID,
      'X-Goog-Channel-Token': 'tok',
      'X-Goog-Resource-ID': 'resource-1',
      'X-Goog-Resource-State': 'exists',
    });

    expect(readPushNotification(headers)).toEqual({
      channelId: CHANNEL_ID,
      token: 'tok',
      resourceId: 'resource-1',
      resourceState: 'exists',
    });
  });
});

describe('handlePushNotification', () => {
  it('runs an incremental sync for a verified change notification', async () => {
    const { services, google, repo } = createFakeServices();

    expect(await handlePushNotification(services, notification())).toBe(
      'synced',
    );
    expect(repo.calendarByChannel).toHaveBeenCalledWith(CHANNEL_ID);
    expect(google.listEvents).toHaveBeenCalledWith(
      'access-1',
      'me@gmail.com',
      expect.objectContaining({ syncToken: 'sync-1' }),
    );
    expect(repo.applySync).toHaveBeenCalledWith(
      CALENDAR_ID,
      expect.objectContaining({ mode: 'incremental' }),
    );
  });

  it('rejects a forged or missing channel token without touching the database', async () => {
    const { services, repo } = createFakeServices();

    expect(
      await handlePushNotification(services, notification({ token: 'forged' })),
    ).toBe('rejected');
    expect(
      await handlePushNotification(services, notification({ channelId: null })),
    ).toBe('rejected');
    expect(
      await handlePushNotification(
        services,
        notification({ token: signValue(CHANNEL_ID, 'another-secret') }),
      ),
    ).toBe('rejected');
    expect(repo.calendarByChannel).not.toHaveBeenCalled();
  });

  it('ignores channels Bell no longer knows or that point at another resource', async () => {
    const { services, repo, google } = createFakeServices();
    repo.calendarByChannel.mockResolvedValueOnce(null);

    expect(await handlePushNotification(services, notification())).toBe(
      'unknown-channel',
    );
    expect(
      await handlePushNotification(
        services,
        notification({ resourceId: 'someone-else' }),
      ),
    ).toBe('unknown-channel');
    repo.calendarByChannel.mockResolvedValueOnce(
      calendarRow({ active: false }),
    );
    expect(await handlePushNotification(services, notification())).toBe(
      'unknown-channel',
    );
    expect(google.listEvents).not.toHaveBeenCalled();
  });

  it('acknowledges the channel handshake without fetching', async () => {
    const { services, google } = createFakeServices();

    expect(
      await handlePushNotification(
        services,
        notification({ resourceState: 'sync' }),
      ),
    ).toBe('acknowledged');
    expect(google.listEvents).not.toHaveBeenCalled();
  });

  it('reports a failed sync so Google retries, after recording it', async () => {
    const { services, google, repo } = createFakeServices();
    google.listEvents.mockRejectedValue(new GoogleApiError(500, 'Google 500'));

    expect(await handlePushNotification(services, notification())).toBe(
      'sync-failed',
    );
    expect(repo.recordFailure).toHaveBeenCalledWith(CALENDAR_ID, 'Google 500');
  });

  it('maps outcomes to HTTP statuses', () => {
    expect(PUSH_OUTCOME_STATUS).toEqual({
      synced: 200,
      acknowledged: 200,
      rejected: 401,
      'unknown-channel': 404,
      'sync-failed': 500,
    });
  });
});
