import { runTick } from '@/lib/tick';
import { createFakeServices } from '@/test-utils/calendarFakes';
import { createFakeNotifyServices } from '@/test-utils/notifyFakes';

describe('runTick records the bell-notify run', () => {
  it('records a good tick with what it did', async () => {
    const { services } = createFakeServices();
    const notify = createFakeNotifyServices();

    await runTick(services, notify.services);

    expect(notify.repo.recordJobRun).toHaveBeenCalledWith({
      job: 'bell-notify',
      ok: true,
      detail: 'sent=0 failed=0 renewed=0',
      at: '2026-10-10T13:30:00.000Z',
    });
  });

  it('records a failed tick with the reason and still fails the request', async () => {
    const { services } = createFakeServices();
    const notify = createFakeNotifyServices();
    notify.repo.claimDue.mockRejectedValue(new Error('connection reset'));

    await expect(runTick(services, notify.services)).rejects.toThrow(
      'connection reset',
    );
    expect(notify.repo.recordJobRun).toHaveBeenCalledTimes(1);
    expect(notify.repo.recordJobRun).toHaveBeenCalledWith({
      job: 'bell-notify',
      ok: false,
      detail: 'connection reset',
      at: '2026-10-10T13:30:00.000Z',
    });
  });

  it('a failed channel renewal fails the tick too', async () => {
    const { services, repo } = createFakeServices();
    const notify = createFakeNotifyServices();
    repo.calendarsDueForRenewal.mockRejectedValue(new Error('db down'));

    await expect(runTick(services, notify.services)).rejects.toThrow('db down');
    expect(notify.repo.recordJobRun).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, detail: 'db down' }),
    );
  });
});
