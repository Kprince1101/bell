import { NextResponse } from 'next/server';
import { parseBody, requireUser, withRouteErrors } from '@/lib/apiRoute';
import { acknowledgeEvent } from '@/lib/notify/acknowledge';
import { notifyServices } from '@/lib/notify/notifyServices';
import { acknowledgeBody } from '@/lib/schemas/notifications';

export const POST = withRouteErrors(async (request: Request) => {
  const { user } = await requireUser();
  const { eventId } = await parseBody(request, acknowledgeBody);
  await acknowledgeEvent(
    notifyServices(),
    { eventId, userId: user.id },
    `app:${user.email ?? user.id}`,
  );
  return NextResponse.json({ acknowledged: true });
});
