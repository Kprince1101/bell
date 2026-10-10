import { NextResponse } from 'next/server';
import { parseBody, requireUser, withRouteErrors } from '@/lib/apiRoute';
import { setCalendarQuiet } from '@/lib/notify/channels';
import { notifyServices } from '@/lib/notify/notifyServices';
import { quietBody } from '@/lib/schemas/notifications';

export const PUT = withRouteErrors(async (request: Request) => {
  const { user } = await requireUser();
  const { calendarId, quiet } = await parseBody(request, quietBody);
  await setCalendarQuiet(notifyServices(), user.id, calendarId, quiet);
  return NextResponse.json({ saved: true });
});
