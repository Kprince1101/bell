import {
  LOGIN_ERROR_MESSAGES,
  LOGIN_NOTICE_MESSAGES,
  NOT_INVITED_CODE,
  NOT_INVITED_MESSAGE,
  PUBLIC_PATH_PREFIXES,
} from '@/lib/constants';
import type { BellClient } from '@/lib/supabase/server';
import { resolveTimeZone } from '@/lib/timeZone';
import type { Database } from '@/types/supabase';

export type BellUser = Database['bell']['Tables']['users']['Row'];

export type SignInOutcome = 'signed-in' | 'not-invited' | 'failed';

export interface LoginSearchParams {
  error?: string;
  notice?: string;
}

export interface LoginMessages {
  error: string | null;
  notice: string | null;
}

export const SIGN_IN_REDIRECTS: Record<SignInOutcome, string> = {
  'signed-in': '/',
  'not-invited': '/login?error=not-invited',
  failed: '/login?error=failed',
};

export const callbackUrl = (origin: string, timeZone: string): string => {
  const url = new URL('/auth/callback', origin);
  url.searchParams.set('tz', timeZone);
  return url.toString();
};

export const isNotInvitedError = (description: string | null): boolean =>
  Boolean(description?.includes(NOT_INVITED_MESSAGE));

export const completeSignIn = async (
  supabase: BellClient,
  params: URLSearchParams,
): Promise<SignInOutcome> => {
  if (isNotInvitedError(params.get('error_description'))) return 'not-invited';

  const code = params.get('code');
  if (!code) return 'failed';

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error(error);
    return 'failed';
  }

  const { error: claimError } = await supabase.rpc('claim_account', {
    p_time_zone: resolveTimeZone(params.get('tz')),
  });
  if (!claimError) return 'signed-in';

  await supabase.auth.signOut({ scope: 'local' });
  if (claimError.code === NOT_INVITED_CODE) return 'not-invited';
  console.error(claimError);
  return 'failed';
};

export const getBellUser = async (
  supabase: BellClient,
): Promise<BellUser | null> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  return data;
};

export const isPublicPath = (pathname: string): boolean =>
  PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

export const resolveLoginMessages = ({
  error,
  notice,
}: LoginSearchParams): LoginMessages => ({
  error: LOGIN_ERROR_MESSAGES[error ?? ''] ?? null,
  notice: LOGIN_NOTICE_MESSAGES[notice ?? ''] ?? null,
});
