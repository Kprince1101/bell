'use server';

import { revalidatePath } from 'next/cache';
import { GENERIC_ERROR_MESSAGE } from '@/lib/constants';
import { inviteEmail } from '@/lib/invites';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { InviteFormState } from '@/types/invites';

export const inviteAction = async (
  _previous: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> => {
  try {
    const result = await inviteEmail(
      await createClient(),
      createAdminClient(),
      formData.get('email'),
    );
    revalidatePath('/invites');
    return result;
  } catch (err) {
    console.error(err);
    return { status: 'error', message: GENERIC_ERROR_MESSAGE };
  }
};
