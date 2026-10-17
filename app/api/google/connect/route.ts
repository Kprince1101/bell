import { NextResponse } from 'next/server';
import { requireUser, withRouteErrors } from '@/lib/apiRoute';
import { bellServices } from '@/lib/calendars/bellServices';
import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_COOKIE_OPTIONS,
} from '@/lib/calendars/oauth';
import { randomState } from '@/lib/crypto/tokenCipher';

export const GET = withRouteErrors(async () => {
  await requireUser();
  const state = randomState();
  const response = NextResponse.redirect(
    bellServices().google.authorizeUrl(state),
  );
  response.cookies.set(GOOGLE_STATE_COOKIE, state, GOOGLE_STATE_COOKIE_OPTIONS);
  return response;
});
