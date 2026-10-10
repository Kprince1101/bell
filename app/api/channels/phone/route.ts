import { NextResponse } from 'next/server';
import { parseBody, requireUser, withRouteErrors } from '@/lib/apiRoute';
import { savePhoneNumber } from '@/lib/notify/channels';
import { notifyServices } from '@/lib/notify/notifyServices';
import { phoneBody } from '@/lib/schemas/notifications';

export const PUT = withRouteErrors(async (request: Request) => {
  const { user } = await requireUser();
  const { number } = await parseBody(request, phoneBody, { explain: true });
  await savePhoneNumber(notifyServices(), user.id, number);
  return NextResponse.json({ saved: true });
});
