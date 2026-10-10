import { redirect } from 'next/navigation';
import { getBellUser } from '@/lib/auth';
import type { BellUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const requireBellUser = async (): Promise<BellUser> => {
  const user = await getBellUser(await createClient());
  if (!user) redirect('/login?error=not-invited');
  return user;
};

export const redirectIfSignedIn = async (): Promise<void> => {
  const user = await getBellUser(await createClient());
  if (user) redirect('/');
};
