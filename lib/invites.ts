import { z } from 'zod';
import type { AdminClient } from '@/lib/account';
import { EMAIL_EXISTS_AUTH_CODE, INVITE_MESSAGES } from '@/lib/constants';
import type { BellClient } from '@/lib/supabase/server';
import type { Invite, InviteFormState } from '@/types/invites';

export const INITIAL_INVITE_STATE: InviteFormState = {
  status: 'idle',
  message: null,
};

export const inviteEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email());

export const isOwner = async (supabase: BellClient): Promise<boolean> => {
  const { data, error } = await supabase.rpc('is_owner');
  if (error) throw error;
  return Boolean(data);
};

export const listInvites = async (supabase: BellClient): Promise<Invite[]> => {
  const { data, error } = await supabase
    .from('allowlist')
    .select('email, role, added_at')
    .order('added_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const ensureAuthUser = async (
  admin: AdminClient,
  email: string,
): Promise<'created' | 'existing'> => {
  const { error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (!error) return 'created';
  if (error.code === EMAIL_EXISTS_AUTH_CODE) return 'existing';
  throw error;
};

export const inviteEmail = async (
  supabase: BellClient,
  admin: AdminClient,
  rawEmail: unknown,
): Promise<InviteFormState> => {
  if (!(await isOwner(supabase))) {
    return { status: 'error', message: INVITE_MESSAGES.notOwner };
  }

  const parsed = inviteEmailSchema.safeParse(rawEmail);
  if (!parsed.success) {
    return { status: 'error', message: INVITE_MESSAGES.invalidEmail };
  }

  const email = parsed.data;
  const { error } = await admin
    .from('allowlist')
    .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true });
  if (error) throw error;

  await ensureAuthUser(admin, email);
  return {
    status: 'invited',
    message: `${email} can now sign in to Bell with Google or an email link.`,
  };
};
