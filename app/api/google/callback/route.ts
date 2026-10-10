import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireUser, withRouteErrors } from '@/lib/apiRoute';
import { bellServices } from '@/lib/calendars/bellServices';
import {
  CONNECT_REDIRECTS,
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_COOKIE_OPTIONS,
  completeGoogleConnect,
} from '@/lib/calendars/oauth';

export const GET = withRouteErrors(async (request: NextRequest) => {
  const { user } = await requireUser();
  const { searchParams } = request.nextUrl;
  const outcome = await completeGoogleConnect(bellServices(), {
    userId: user.id,
    code: searchParams.get('code'),
    state: searchParams.get('state'),
    expectedState: request.cookies.get(GOOGLE_STATE_COOKIE)?.value,
    error: searchParams.get('error'),
  });
  const response = NextResponse.redirect(
    new URL(CONNECT_REDIRECTS[outcome], request.nextUrl.origin),
  );
  response.cookies.set(GOOGLE_STATE_COOKIE, '', {
    ...GOOGLE_STATE_COOKIE_OPTIONS,
    maxAge: 0,
  });
  return response;
});
