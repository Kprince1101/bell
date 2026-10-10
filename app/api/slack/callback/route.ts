import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireUser, withRouteErrors } from '@/lib/apiRoute';
import {
  SLACK_CONNECT_REDIRECTS,
  SLACK_STATE_COOKIE,
  completeSlackConnect,
} from '@/lib/notify/channels';
import { notifyServices } from '@/lib/notify/notifyServices';
import { SLACK_STATE_COOKIE_OPTIONS } from '@/lib/notify/slackCookie';

export const GET = withRouteErrors(async (request: NextRequest) => {
  const { user } = await requireUser();
  const { searchParams } = request.nextUrl;
  const outcome = await completeSlackConnect(notifyServices(), user.id, {
    code: searchParams.get('code'),
    state: searchParams.get('state'),
    expectedState: request.cookies.get(SLACK_STATE_COOKIE)?.value,
    error: searchParams.get('error'),
  });
  const response = NextResponse.redirect(
    new URL(SLACK_CONNECT_REDIRECTS[outcome], request.nextUrl.origin),
  );
  response.cookies.set(SLACK_STATE_COOKIE, '', {
    ...SLACK_STATE_COOKIE_OPTIONS,
    maxAge: 0,
  });
  return response;
});
