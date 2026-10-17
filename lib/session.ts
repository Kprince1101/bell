import { notFound, redirect } from 'next/navigation';
import { getBellUser } from '@/lib/auth';
import type { BellUser } from '@/lib/auth';
import { isOwner, listInvites } from '@/lib/invites';
import { createClient } from '@/lib/supabase/server';
import type { Invite } from '@/types/invites';

export interface AppShell {
  user: BellUser;
  isOwner: boolean;
}

export const requireBellUser = async (): Promise<BellUser> => {
  const user = await getBellUser(await createClient());
  if (!user) redirect('/login?error=not-invited');
  return user;
};

export const loadAppShell = async (): Promise<AppShell> => {
  const supabase = await createClient();
  const user = await getBellUser(supabase);
  if (!user) redirect('/login?error=not-invited');
  return { user, isOwner: await isOwner(supabase) };
};

export const requireOwnerInvites = async (): Promise<Invite[]> => {
  const supabase = await createClient();
  if (!(await isOwner(supabase))) notFound();
  return listInvites(supabase);
};

export const requireOwnerUser = async (): Promise<BellUser> => {
  const { user, isOwner: owner } = await loadAppShell();
  if (!owner) notFound();
  return user;
};

export const redirectIfSignedIn = async (): Promise<void> => {
  const user = await getBellUser(await createClient());
  if (user) redirect('/');
};
