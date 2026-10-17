import { NextResponse } from 'next/server';
import { SIGN_IN_REDIRECTS, completeSignIn } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const GET = async (request: Request) => {
  const { searchParams, origin } = new URL(request.url);
  const outcome = await completeSignIn(await createClient(), searchParams);

  return NextResponse.redirect(new URL(SIGN_IN_REDIRECTS[outcome], origin));
};
