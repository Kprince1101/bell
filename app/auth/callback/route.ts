import { NextResponse } from 'next/server';
import { SIGN_IN_REDIRECTS, completeSignIn } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const GET = async (request: Request) => {
  const { searchParams, origin } = new URL(request.url);
  const supabase = await createClient();
  const outcome = await completeSignIn(
    supabase,
    searchParams.get('code'),
    searchParams.get('tz'),
  );

  return NextResponse.redirect(new URL(SIGN_IN_REDIRECTS[outcome], origin));
};
