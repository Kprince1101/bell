import type { SupabaseClient } from '@supabase/supabase-js';
import type { BellUser } from '@/lib/auth';
import type { BellClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

export type AdminClient = SupabaseClient<Database, 'bell'>;

export interface DeleteAccountResult {
  authUserRemoved: boolean;
}

export const updateTimeZone = async (
  supabase: BellClient,
  userId: string,
  timeZone: string,
): Promise<BellUser> => {
  const { data, error } = await supabase
    .from('users')
    .update({ time_zone: timeZone })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

export const deleteAccount = async (
  supabase: BellClient,
  admin: AdminClient,
  userId: string,
): Promise<DeleteAccountResult> => {
  const { data: removeAuthUser, error } = await supabase.rpc('delete_me');
  if (error) throw error;

  if (removeAuthUser) {
    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError) throw authError;
  }

  await supabase.auth.signOut({ scope: 'local' });
  return { authUserRemoved: Boolean(removeAuthUser) };
};
