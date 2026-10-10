import { NextResponse } from 'next/server';
import { parseBody, requireUser, withRouteErrors } from '@/lib/apiRoute';
import {
  createShareRepo,
  removeShare,
  shareCalendar,
} from '@/lib/calendars/sharing';
import { shareBody, unshareBody } from '@/lib/schemas/calendars';
import { createAdminClient } from '@/lib/supabase/admin';

export const POST = withRouteErrors(async (request: Request) => {
  const { user } = await requireUser();
  const { calendarId, email } = await parseBody(request, shareBody, {
    explain: true,
  });
  await shareCalendar(
    createShareRepo(createAdminClient()),
    user.id,
    calendarId,
    email,
  );
  return NextResponse.json({ shared: true });
});

export const DELETE = withRouteErrors(async (request: Request) => {
  const { user } = await requireUser();
  const { calendarId, sharedWithUserId } = await parseBody(
    request,
    unshareBody,
  );
  await removeShare(
    createShareRepo(createAdminClient()),
    user.id,
    calendarId,
    sharedWithUserId,
  );
  return NextResponse.json({ removed: true });
});
