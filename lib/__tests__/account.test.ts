import { deleteAccount, updateTimeZone } from '@/lib/account';
import {
  BELL_USER,
  USER_ID,
  createAdminFake,
  createSupabaseFake,
} from '@/test-utils/supabaseFake';

const noGoogle = async () => undefined;

describe('deleteAccount', () => {
  it('stops Google first, then wipes bell data, removes the auth user and clears the session', async () => {
    const order: string[] = [];
    const { client, fake } = createSupabaseFake();
    const admin = createAdminFake();
    const disconnectGoogle = vi.fn(async () => {
      order.push('disconnectGoogle');
    });
    fake.rpc.mockImplementation(async () => {
      order.push('delete_me');
      return { data: true, error: null };
    });
    admin.fake.auth.admin.deleteUser.mockImplementation(async () => {
      order.push('deleteUser');
      return { data: {}, error: null };
    });
    fake.auth.signOut.mockImplementation(async () => {
      order.push('signOut');
      return { error: null };
    });

    const result = await deleteAccount(
      client,
      admin.client,
      USER_ID,
      disconnectGoogle,
    );

    expect(result).toEqual({ authUserRemoved: true });
    expect(fake.rpc).toHaveBeenCalledWith('delete_me');
    expect(admin.fake.auth.admin.deleteUser).toHaveBeenCalledWith(USER_ID);
    expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(order).toEqual([
      'disconnectGoogle',
      'delete_me',
      'deleteUser',
      'signOut',
    ]);
  });

  it('logs a failed Google release and still wipes bell data and the auth user', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { client, fake } = createSupabaseFake();
    const admin = createAdminFake();
    const failure = new Error(
      'BELL_TOKEN_KEY must be 32 bytes, base64 encoded',
    );

    const result = await deleteAccount(client, admin.client, USER_ID, () =>
      Promise.reject(failure),
    );

    expect(result).toEqual({ authUserRemoved: true });
    expect(consoleError).toHaveBeenCalledWith(
      '[bell] delete-me google-release-failed',
      failure,
    );
    expect(fake.rpc).toHaveBeenCalledWith('delete_me');
    expect(admin.fake.auth.admin.deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it('keeps the auth user of someone who also has a Commander profile', async () => {
    const { client, fake } = createSupabaseFake({ rpcData: false });
    const admin = createAdminFake();

    const result = await deleteAccount(client, admin.client, USER_ID, noGoogle);

    expect(result).toEqual({ authUserRemoved: false });
    expect(fake.rpc).toHaveBeenCalledWith('delete_me');
    expect(admin.fake.auth.admin.deleteUser).not.toHaveBeenCalled();
    expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('keeps the auth user when the bell wipe fails', async () => {
    const { client } = createSupabaseFake({ rpcError: new Error('boom') });
    const admin = createAdminFake();

    await expect(
      deleteAccount(client, admin.client, USER_ID, noGoogle),
    ).rejects.toThrow('boom');
    expect(admin.fake.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('surfaces a failed auth deletion', async () => {
    const { client, fake } = createSupabaseFake();
    const admin = createAdminFake({ deleteError: new Error('auth down') });

    await expect(
      deleteAccount(client, admin.client, USER_ID, noGoogle),
    ).rejects.toThrow('auth down');
    expect(fake.auth.signOut).not.toHaveBeenCalled();
  });
});

describe('updateTimeZone', () => {
  it('updates only the time zone on the caller row', async () => {
    const { client, fake } = createSupabaseFake();

    expect(await updateTimeZone(client, USER_ID, 'America/Chicago')).toEqual(
      BELL_USER,
    );
    expect(fake.query.update).toHaveBeenCalledWith({
      time_zone: 'America/Chicago',
    });
    expect(fake.query.eq).toHaveBeenCalledWith('id', USER_ID);
  });

  it('throws the database error', async () => {
    const { client } = createSupabaseFake({
      row: { data: null, error: new Error('denied') },
    });

    await expect(updateTimeZone(client, USER_ID, 'UTC')).rejects.toThrow(
      'denied',
    );
  });
});
