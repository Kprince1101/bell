import { NextResponse } from 'next/server';
import { requireUser, withRouteErrors } from '@/lib/apiRoute';
import { randomState } from '@/lib/crypto/tokenCipher';
import { SLACK_STATE_COOKIE } from '@/lib/notify/channels';
import { notifyServices } from '@/lib/notify/notifyServices';
import { SLACK_STATE_COOKIE_OPTIONS } from '@/lib/notify/slackCookie';

export const GET = withRouteErrors(async () => {
  await requireUser();
  const state = randomState();
  const response = NextResponse.redirect(
    notifyServices().slack.authorizeUrl(state),
  );
  response.cookies.set(SLACK_STATE_COOKIE, state, SLACK_STATE_COOKIE_OPTIONS);
  return response;
});
