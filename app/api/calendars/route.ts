import { NextResponse } from 'next/server';
import { parseBody, requireUser, withRouteErrors } from '@/lib/apiRoute';
import { bellServices } from '@/lib/calendars/bellServices';
import { applyCalendarChoices } from '@/lib/calendars/selection';
import { calendarChoicesBody } from '@/lib/schemas/calendars';

export const PUT = withRouteErrors(async (request: Request) => {
  const { user } = await requireUser();
  const { calendars } = await parseBody(request, calendarChoicesBody);
  await applyCalendarChoices(bellServices(), user.id, calendars);
  return NextResponse.json({ saved: true });
});
