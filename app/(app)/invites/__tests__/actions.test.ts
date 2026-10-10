import { revalidatePath } from 'next/cache';
import { inviteAction } from '@/app/(app)/invites/actions';
import { GENERIC_ERROR_MESSAGE } from '@/lib/constants';
import { INITIAL_INVITE_STATE } from '@/lib/invites';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { createAdminFake, createSupabaseFake } from '@/test-utils/supabaseFake';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));

const formWith = (email: string) => {
  const form = new FormData();
  form.set('email', email);
  return form;
};

const wire = (adminOptions = {}) => {
  const supabase = createSupabaseFake();
  const admin = createAdminFake(adminOptions);
  vi.mocked(createClient).mockResolvedValue(supabase.client);
  vi.mocked(createAdminClient).mockReturnValue(admin.client);
  return admin.fake;
};

describe('inviteAction', () => {
  it('invites with the service-role client and refreshes the list', async () => {
    const admin = wire();

    const state = await inviteAction(
      INITIAL_INVITE_STATE,
      formWith('new@example.com'),
    );

    expect(state.status).toBe('invited');
    expect(admin.auth.admin.createUser).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/invites');
  });

  it('hides unexpected failures behind a generic message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    wire({ upsertError: new Error('relation bell.allowlist does not exist') });

    expect(
      await inviteAction(INITIAL_INVITE_STATE, formWith('new@example.com')),
    ).toEqual({ status: 'error', message: GENERIC_ERROR_MESSAGE });
  });
});
