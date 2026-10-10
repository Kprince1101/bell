import { applyCalendarChoices } from '@/lib/calendars/selection';
import { GoogleApiError } from '@/lib/google/errors';
import {
  CALENDAR_ID,
  CHANNEL_ID,
  calendarRow,
  createFakeServices,
  eventsPage,
} from '@/test-utils/calendarFakes';
import { STANDUP } from '@/test-utils/googleFixtures';
import { USER_ID } from '@/test-utils/supabaseFake';

const PICKED = calendarRow({
  active: false,
  sync_token: null,
  channel_id: null,
  channel_resource_id: null,
  channel_expires_at: null,
  last_sync_at: null,
});

const choice = (overrides = {}) => ({
  id: CALENDAR_ID,
  active: true,
  paused: false,
  label: 'Client A',
  color: '#ff8800',
  ...overrides,
});

describe('applyCalendarChoices', () => {
  it('saves the label and color, does one full sync, then watches the calendar', async () => {
    const { services, google, repo } = createFakeServices();
    repo.calendarsForUser.mockResolvedValue([PICKED]);
    google.listEvents.mockResolvedValue(eventsPage({ items: [STANDUP] }));

    await applyCalendarChoices(services, USER_ID, [choice()]);

    expect(repo.saveChoice).toHaveBeenCalledWith(choice());
    expect(google.listEvents).toHaveBeenCalledTimes(1);
    expect(google.listEvents.mock.calls[0][2]).toMatchObject({
      timeMin: '2026-10-03T12:00:00.000Z',
      timeMax: '2026-12-09T12:00:00.000Z',
    });
    expect(repo.applySync).toHaveBeenCalledWith(
      CALENDAR_ID,
      expect.objectContaining({ mode: 'full', nextSyncToken: 'sync-2' }),
    );
    expect(google.watchEvents).toHaveBeenCalledTimes(1);
    expect(repo.saveChannel).toHaveBeenCalledTimes(1);
    expect(google.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('does not watch a calendar whose first sync failed', async () => {
    const { services, google, repo } = createFakeServices();
    repo.calendarsForUser.mockResolvedValue([PICKED]);
    google.listEvents.mockRejectedValue(new GoogleApiError(403, 'Google 403'));

    await applyCalendarChoices(services, USER_ID, [choice()]);

    expect(repo.recordFailure).toHaveBeenCalledWith(CALENDAR_ID, 'Google 403');
    expect(google.watchEvents).not.toHaveBeenCalled();
  });

  it('records a watch registration failure visibly', async () => {
    const { services, google, repo } = createFakeServices();
    repo.calendarsForUser.mockResolvedValue([PICKED]);
    google.watchEvents.mockRejectedValue(
      new GoogleApiError(
        401,
        'Google 401: Unauthorized WebHook callback channel',
      ),
    );

    await applyCalendarChoices(services, USER_ID, [choice()]);

    expect(repo.recordFailure).toHaveBeenCalledWith(
      CALENDAR_ID,
      'Watch registration failed: Google 401: Unauthorized WebHook callback channel',
    );
  });

  it('only renames an already active calendar', async () => {
    const { services, google, repo } = createFakeServices();

    await applyCalendarChoices(services, USER_ID, [
      choice({ label: 'Renamed' }),
    ]);

    expect(repo.saveChoice).toHaveBeenCalledWith(choice({ label: 'Renamed' }));
    expect(google.listEvents).not.toHaveBeenCalled();
    expect(google.watchEvents).not.toHaveBeenCalled();
  });

  it('pauses a calendar without touching its sync or channel', async () => {
    const { services, google, repo } = createFakeServices();

    await applyCalendarChoices(services, USER_ID, [choice({ paused: true })]);

    expect(repo.saveChoice).toHaveBeenCalledWith(choice({ paused: true }));
    expect(google.stopChannel).not.toHaveBeenCalled();
    expect(repo.clearCalendar).not.toHaveBeenCalled();
    expect(google.listEvents).not.toHaveBeenCalled();
  });

  it('stops the channel and clears the events of a calendar that is dropped', async () => {
    const { services, google, repo } = createFakeServices();

    await applyCalendarChoices(services, USER_ID, [choice({ active: false })]);

    expect(google.stopChannel).toHaveBeenCalledWith('access-1', {
      id: CHANNEL_ID,
      resourceId: 'resource-1',
    });
    expect(repo.clearCalendar).toHaveBeenCalledWith(CALENDAR_ID);
    expect(repo.saveChoice).toHaveBeenCalledWith(choice({ active: false }));
  });

  it('refuses calendars that belong to someone else', async () => {
    const { services, repo } = createFakeServices();

    await expect(
      applyCalendarChoices(services, USER_ID, [
        choice({ id: 'cccccccc-9999-0000-0000-000000000000' }),
      ]),
    ).rejects.toThrow('Unknown calendar');
    expect(repo.saveChoice).not.toHaveBeenCalled();
  });
});
