import { act, renderHook } from '@testing-library/react';
import type { ChangeEvent, FormEvent } from 'react';
import { useAccountClient } from '@/hooks/useAccountClient';
import { requestAccountDeletion, saveTimeZone } from '@/lib/accountApi';
import { redirectTo } from '@/lib/navigation';

vi.mock('@/lib/accountApi', () => ({
  requestAccountDeletion: vi.fn(),
  saveTimeZone: vi.fn(),
}));
vi.mock('@/lib/navigation', () => ({ redirectTo: vi.fn() }));

const PROPS = {
  email: 'me@example.com',
  timeZone: 'UTC',
  timeZones: ['UTC', 'Asia/Tokyo'],
};

const submitEvent = () =>
  ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;

const typed = <Element,>(value: string) =>
  ({ target: { value } }) as unknown as ChangeEvent<Element>;

describe('useAccountClient deletion', () => {
  it('stays locked until DELETE is typed exactly', async () => {
    const { result } = renderHook(() => useAccountClient(PROPS));

    act(() =>
      result.current.deletion.handleConfirmChange(
        typed<HTMLInputElement>('delete'),
      ),
    );
    expect(result.current.deletion.canDelete).toBe(false);
    await act(() => result.current.deletion.handleDelete(submitEvent()));
    expect(requestAccountDeletion).not.toHaveBeenCalled();

    act(() =>
      result.current.deletion.handleConfirmChange(
        typed<HTMLInputElement>('DELETE'),
      ),
    );
    expect(result.current.deletion.canDelete).toBe(true);
  });

  it('deletes and leaves for the login page', async () => {
    vi.mocked(requestAccountDeletion).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAccountClient(PROPS));

    act(() =>
      result.current.deletion.handleConfirmChange(
        typed<HTMLInputElement>('DELETE'),
      ),
    );
    await act(() => result.current.deletion.handleDelete(submitEvent()));

    expect(requestAccountDeletion).toHaveBeenCalledTimes(1);
    expect(redirectTo).toHaveBeenCalledWith('/login?notice=deleted');
  });

  it('shows the error and stays put when deletion fails', async () => {
    vi.mocked(requestAccountDeletion).mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => useAccountClient(PROPS));

    act(() =>
      result.current.deletion.handleConfirmChange(
        typed<HTMLInputElement>('DELETE'),
      ),
    );
    await act(() => result.current.deletion.handleDelete(submitEvent()));

    expect(result.current.deletion.showDeleteError).toBe(true);
    expect(result.current.deletion.deleteError).toBe('nope');
    expect(redirectTo).not.toHaveBeenCalled();
    expect(result.current.deletion.canDelete).toBe(true);
  });
});

describe('useAccountClient time zone', () => {
  it('saves only after the zone changes', async () => {
    vi.mocked(saveTimeZone).mockResolvedValue('Asia/Tokyo');
    const { result } = renderHook(() => useAccountClient(PROPS));

    expect(result.current.timeZoneSetting.canSaveTimeZone).toBe(false);
    act(() =>
      result.current.timeZoneSetting.handleTimeZoneChange(
        typed<HTMLSelectElement>('Asia/Tokyo'),
      ),
    );
    expect(result.current.timeZoneSetting.canSaveTimeZone).toBe(true);
    await act(() =>
      result.current.timeZoneSetting.handleSaveTimeZone(submitEvent()),
    );

    expect(saveTimeZone).toHaveBeenCalledWith('Asia/Tokyo');
    expect(result.current.timeZoneSetting.savedTimeZone).toBe('Asia/Tokyo');
    expect(result.current.timeZoneSetting.canSaveTimeZone).toBe(false);
  });

  it('reports a failed save', async () => {
    vi.mocked(saveTimeZone).mockRejectedValue(new Error('Invalid request'));
    const { result } = renderHook(() => useAccountClient(PROPS));

    act(() =>
      result.current.timeZoneSetting.handleTimeZoneChange(
        typed<HTMLSelectElement>('Asia/Tokyo'),
      ),
    );
    await act(() =>
      result.current.timeZoneSetting.handleSaveTimeZone(submitEvent()),
    );

    expect(result.current.timeZoneSetting.timeZoneError).toBe(
      'Invalid request',
    );
    expect(result.current.timeZoneSetting.saveLabel).toBe('Save');
  });
});
