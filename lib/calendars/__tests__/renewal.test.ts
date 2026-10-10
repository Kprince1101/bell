import { renewChannels } from '@/lib/calendars/renewal';
import { verifySignedValue } from '@/lib/crypto/tokenCipher';
import { GoogleApiError } from '@/lib/google/errors';
import { runTick } from '@/lib/tick';
import {
  CALENDAR_ID,
  CHANNEL_ID,
  TEST_CONFIG,
  calendarRow,
  createFakeServices,
} from '@/test-utils/calendarFakes';

const EXPIRING = calendarRow({
  channel_expires_at: '2026-10-11T06:00:00.000Z',
});
const SECOND_ID = 'cccccccc-0000-0000-0000-000000000002';

describe('renewChannels', () => {
  it('asks only for channels expiring within 24 hours', async () => {
    const { services, repo } = createFakeServices();

    await renewChannels(services);

    expect(repo.calendarsDueForRenewal).toHaveBeenCalledWith(
      '2026-10-11T12:00:00.000Z',
    );
  });

  it('registers a fresh signed channel, saves it, then stops the old one', async () => {
    const { services, google, repo } = createFakeServices();
    repo.calendarsDueForRenewal.mockResolvedValue([EXPIRING]);

    const report = await renewChannels(services);

    const [, calendarId, request] = google.watchEvents.mock.calls[0];
    expect(calendarId).toBe('me@gmail.com');
    expect(request).toMatchObject({
      address: TEST_CONFIG.webhookUrl,
      ttlSeconds: 604800,
    });
    expect(request.id).not.toBe(CHANNEL_ID);
    expect(
      verifySignedValue(
        request.id,
        (request as { token: string }).token,
        TEST_CONFIG.webhookSecret,
      ),
    ).toBe(true);
    expect(repo.saveChannel).toHaveBeenCalledWith(EXPIRING, {
      channelId: request.id,
      resourceId: 'resource-2',
      expiresAt: '2026-10-17T12:00:00.000Z',
    });
    expect(google.stopChannel).toHaveBeenCalledWith('access-1', {
      id: CHANNEL_ID,
      resourceId: 'resource-1',
    });
    expect(report).toEqual({
      renewed: [CALENDAR_ID],
      failed: [],
      pushStopped: [],
    });
  });

  it('never fetches events: renewal is the only timer and it only re-watches', async () => {
    const { services, google, repo, log } = createFakeServices();
    repo.calendarsDueForRenewal.mockResolvedValue([
      EXPIRING,
      calendarRow({ id: SECOND_ID }),
    ]);

    await runTick(services);

    expect(google.listEvents).not.toHaveBeenCalled();
    expect(repo.applySync).not.toHaveBeenCalled();
    expect(
      log.mock.calls
        .flat()
        .some((line) => String(line).includes('[bell] sync ')),
    ).toBe(false);
    expect(log).toHaveBeenCalledWith(
      '[bell] tick renewed=2 failed=0 push-stopped=0',
    );
  });

  it('records a failed renewal and marks calendars whose push has stopped', async () => {
    const { services, google, repo } = createFakeServices();
    repo.calendarsDueForRenewal.mockResolvedValue([EXPIRING]);
    repo.markPushStopped.mockResolvedValue([CALENDAR_ID]);
    google.watchEvents.mockRejectedValue(
      new GoogleApiError(403, 'Google 403: Forbidden'),
    );

    const report = await renewChannels(services);

    expect(repo.recordFailure).toHaveBeenCalledWith(
      CALENDAR_ID,
      'Watch renewal failed: Google 403: Forbidden',
    );
    expect(repo.saveChannel).not.toHaveBeenCalled();
    expect(google.stopChannel).not.toHaveBeenCalled();
    expect(repo.markPushStopped).toHaveBeenCalledWith(
      '2026-10-10T12:00:00.000Z',
    );
    expect(report).toEqual({
      renewed: [],
      failed: [CALENDAR_ID],
      pushStopped: [CALENDAR_ID],
    });
  });

  it('keeps the new channel when stopping the old one fails', async () => {
    const { services, google, repo, log } = createFakeServices();
    repo.calendarsDueForRenewal.mockResolvedValue([EXPIRING]);
    google.stopChannel.mockRejectedValue(new GoogleApiError(503, 'Google 503'));

    const report = await renewChannels(services);

    expect(report.renewed).toEqual([CALENDAR_ID]);
    expect(repo.recordFailure).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      `[bell] unwatch-failed calendar=${CALENDAR_ID} channel=${CHANNEL_ID} error=Google 503`,
    );
  });

  it('re-watches an active calendar that never got a channel', async () => {
    const { services, google, repo } = createFakeServices();
    repo.calendarsDueForRenewal.mockResolvedValue([
      calendarRow({
        channel_id: null,
        channel_resource_id: null,
        channel_expires_at: null,
      }),
    ]);

    await renewChannels(services);

    expect(google.watchEvents).toHaveBeenCalledTimes(1);
    expect(google.stopChannel).not.toHaveBeenCalled();
  });
});
