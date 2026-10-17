import { AuthError } from '@supabase/supabase-js';
import { INVITE_MESSAGES } from '@/lib/constants';
import {
  ensureAuthUser,
  inviteEmail,
  isOwner,
  listInvites,
} from '@/lib/invites';
import {
  INVITES,
  createAdminFake,
  createSupabaseFake,
} from '@/test-utils/supabaseFake';

describe('inviteEmail', () => {
  it('refuses anyone who is not the owner, touching nothing', async () => {
    const { client, fake } = createSupabaseFake({ rpcData: false });
    const admin = createAdminFake();

    expect(await inviteEmail(client, admin.client, 'new@example.com')).toEqual({
      status: 'error',
      message: INVITE_MESSAGES.notOwner,
    });
    expect(fake.rpc).toHaveBeenCalledWith('is_owner');
    expect(admin.fake.from).not.toHaveBeenCalled();
    expect(admin.fake.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('rejects something that is not an email', async () => {
    const { client } = createSupabaseFake();
    const admin = createAdminFake();

    expect(await inviteEmail(client, admin.client, 'not-an-email')).toEqual({
      status: 'error',
      message: INVITE_MESSAGES.invalidEmail,
    });
    expect(admin.fake.from).not.toHaveBeenCalled();
  });

  it('allowlists the lowercased email and creates a confirmed auth user', async () => {
    const { client } = createSupabaseFake();
    const admin = createAdminFake();

    const result = await inviteEmail(
      client,
      admin.client,
      '  New@Example.com ',
    );

    expect(result.status).toBe('invited');
    expect(admin.fake.from).toHaveBeenCalledWith('allowlist');
    expect(admin.fake.allowlist.upsert).toHaveBeenCalledWith(
      { email: 'new@example.com' },
      { onConflict: 'email', ignoreDuplicates: true },
    );
    expect(admin.fake.auth.admin.createUser).toHaveBeenCalledWith({
      email: 'new@example.com',
      email_confirm: true,
    });
  });

  it('reuses an auth user that already exists, such as a Commander login', async () => {
    const { client } = createSupabaseFake();
    const admin = createAdminFake({
      createError: new AuthError('already registered', 422, 'email_exists'),
    });

    expect(
      (await inviteEmail(client, admin.client, 'owner@example.com')).status,
    ).toBe('invited');
  });

  it('throws when the allowlist write fails', async () => {
    const { client } = createSupabaseFake();
    const admin = createAdminFake({ upsertError: new Error('db down') });

    await expect(
      inviteEmail(client, admin.client, 'new@example.com'),
    ).rejects.toThrow('db down');
    expect(admin.fake.auth.admin.createUser).not.toHaveBeenCalled();
  });
});

describe('ensureAuthUser', () => {
  it('throws on an unexpected auth error', async () => {
    const admin = createAdminFake({
      createError: new AuthError('boom', 500, 'unexpected_failure'),
    });

    await expect(ensureAuthUser(admin.client, 'a@example.com')).rejects.toThrow(
      'boom',
    );
  });

  it('reports a new user as created', async () => {
    const admin = createAdminFake();

    expect(await ensureAuthUser(admin.client, 'a@example.com')).toBe('created');
  });
});

describe('isOwner and listInvites', () => {
  it('reads the owner flag and the allowlist through the signed-in client', async () => {
    const { client, fake } = createSupabaseFake();

    expect(await isOwner(client)).toBe(true);
    expect(await listInvites(client)).toEqual(INVITES);
    expect(fake.from).toHaveBeenCalledWith('allowlist');
  });

  it('throws when the owner check fails', async () => {
    const { client } = createSupabaseFake({ rpcError: new Error('nope') });

    await expect(isOwner(client)).rejects.toThrow('nope');
  });
});
